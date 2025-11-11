import { mnemonicToPrivateKey } from '@ton/crypto';
import {
    WalletContractV5R1,
    Address,
    beginCell,
    internal,
    toNano,
    SendMode,
    external,
    storeMessage,
    storeMessageRelaxed
} from '@ton/ton';

import { initClient, execGetMethodForBlockchainAccount, gaslessConfig, gaslessEstimate, gaslessSend, TonApiHttpError } from '@ton-api/client';
import { ContractAdapter } from '@ton-api/ton-adapter';

// if you need to send lots of requests in parallel, make sure you use a tonapi token.
initClient({
    baseUrl: 'https://tonapi.io',
    apiKey: 'YOUR_API_KEY'
});

const provider = new ContractAdapter();

const OP_CODES = {
    TK_RELAYER_FEE: 0x878da6e3,
    JETTON_TRANSFER: 0xf8a7ea5
};

// Amount for jetton transfer. Usually 0.05 TON is enough for most jetton transfers without forwardBody
const BASE_JETTON_SEND_AMOUNT = toNano(0.05);

// this is a simple example of how to send a gasless transfer.
// you only need to specify your seed and a destination address.

// the seed is not sent to the network, it is used to sign messages locally.

const mnemonics = 'word1 word2 ...'.split(' '); // wallet seed `word1 word2 word3 ... word24`
const destination = Address.parse('UQApwowlR6X54bXoso6orKCzCNm9ily8pAFy5vTwmsQ2WvVi'); // replace with a correct recipient address
const usdtMaster = Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'); // USDt jetton master.

const jettonAmount = 1_000_000n; // amount in the smallest jetton units. This is 1 USDt.

const keyPair = await mnemonicToPrivateKey(mnemonics);
const wallet = WalletContractV5R1.create({ publicKey: keyPair.publicKey });
const contract = provider.open(wallet);

console.log('Wallet address:', wallet.address.toString());

const { data: jettonWalletAddressResult, error: getWalletError } =
    await execGetMethodForBlockchainAccount(usdtMaster, 'get_wallet_address', {
        args: [wallet.address.toRawString()]
    });

if (getWalletError) {
    console.error('Error getting jetton wallet:', getWalletError.message);
    process.exit(1);
}

const jettonWallet = Address.parse(jettonWalletAddressResult.decoded.jetton_wallet_address);

// we use USDt in this example,
// so we just print all supported gas jettons and get the relay address.
// we have to send excess to the relay address in order to make a transfer cheaper.
const relayerAddress = await printConfigAndReturnRelayAddress();

// Create payload for jetton transfer
const tetherTransferPayload = beginCell()
    .storeUint(OP_CODES.JETTON_TRANSFER, 32)
    .storeUint(0, 64)
    .storeCoins(jettonAmount) // 1 USDT
    .storeAddress(destination) // address for receiver
    .storeAddress(relayerAddress) // address for excesses
    .storeBit(false) // null custom_payload
    .storeCoins(1n) // count of forward transfers in nanoton
    .storeMaybeRef(undefined)
    .endCell();

const messageToEstimate = beginCell()
    .storeWritable(
        storeMessageRelaxed(
            internal({
                to: jettonWallet,
                bounce: true,
                value: BASE_JETTON_SEND_AMOUNT,
                body: tetherTransferPayload
            })
        )
    )
    .endCell();

// we send a single message containing a transfer from our wallet to a desired destination.
// as a result of estimation, TonAPI returns a list of messages that we need to sign.
// the first message is a fee transfer to the relay address, the second message is our original transfer.
const { data: params, error: estimateError } = await gaslessEstimate(usdtMaster, {
    walletAddress: wallet.address,
    walletPublicKey: keyPair.publicKey.toString('hex'),
    messages: [{ boc: messageToEstimate }]
});

if (estimateError) {
    console.error('Error estimating gasless transfer:', estimateError.message);
    process.exit(1);
}

console.log('Estimated transfer:', params);

const seqno = await contract.getSeqno();

// params is the same structure as params in tonconnect
const tetherTransferForSend = wallet.createTransfer({
    seqno,
    authType: 'internal',
    timeout: Math.ceil(Date.now() / 1000) + 5 * 60,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: params.messages.map(message =>
        internal({
            to: message.address,
            value: BigInt(message.amount),
            body: message.payload
        })
    )
});

const extMessage = beginCell()
    .storeWritable(
        storeMessage(
            external({
                to: contract.address,
                init: seqno === 0 ? contract.init : undefined,
                body: tetherTransferForSend
            })
        )
    )
    .endCell();

// Send a gasless transfer
const { data: sendResult, error: sendError } = await gaslessSend({
    walletPublicKey: keyPair.publicKey.toString('hex'),
    boc: extMessage
});

if (sendError) {
    if (sendError instanceof TonApiHttpError) {
        console.error('Error sending gasless transfer:', sendError.message, 'Status:', sendError.status);
    } else {
        console.error('Error sending gasless transfer:', sendError.message);
    }
} else {
    console.log('A gasless transfer sent!');
}

async function printConfigAndReturnRelayAddress(): Promise<Address> {
    const { data: cfg, error } = await gaslessConfig();

    if (error) {
        console.error('Error getting gasless config:', error.message);
        process.exit(1);
    }

    console.log('Available jettons for gasless transfer');
    console.log(cfg.gasJettons.map(gasJetton => gasJetton.masterId));

    console.log(`Relay address to send fees to: ${cfg.relayAddress}`);
    return cfg.relayAddress;
}

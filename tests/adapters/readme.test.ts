import { SendMode, WalletContractV5R1, internal } from '@ton/ton';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { TonApiClient } from '@ton-api/client';
import { ContractAdapter } from '@ton-api/ton-adapter';
import { test, vi, expect } from 'vitest';

// Create TonApiClient instance
const tonApiClient = new TonApiClient({
    baseUrl: 'https://tonapi.io'
    // apiKey: 'YOUR_API_KEY' // Uncomment and set your API key
});

// Create an adapter with explicit client
const adapter = new ContractAdapter(tonApiClient);

// Create and use a wallet contract
async function main() {
    const mnemonics = await mnemonicNew();
    const keyPair = await mnemonicToPrivateKey(mnemonics);
    const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });

    // Open the contract using the adapter
    const contract = adapter.open(wallet);

    // Get balance
    const balance = await contract.getBalance();
    console.log('Balance:', balance.toString());

    // Send a transfer
    const seqno = await contract.getSeqno();
    await contract
        .sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            messages: [
                internal({
                    value: '0.001',
                    to: 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
                    body: 'Hello world'
                })
            ]
        })
        .catch(error => console.log(error.message)); // can't send transfer from noexists wallet
}

test('Readme example', async () => {
    const consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();

    // Check if console.log was called (Balance + error from sendTransfer)
    expect(consoleLogMock.mock.calls.length).toBeGreaterThanOrEqual(1);

    // Check the first console.log call (Balance)
    expect(consoleLogMock.mock.calls[0]).toEqual(['Balance:', '0']);

    // Restore the original console.log
    consoleLogMock.mockRestore();
});

import {
    GenerateApiParams,
    PrimitiveTypeStruct,
    SchemaComponent,
    generateApi
} from 'swagger-typescript-api';

import path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as yaml from 'js-yaml';

const packageVersion = process.env.npm_package_version;

const openapiPath = path.resolve(process.cwd(), 'src/api.yml');
const openapiUrl = 'https://tonapi.io/v2/openapi.yml';

/**
 * Schema Patches System
 * ---------------------
 * This file (schema-patches.json) contains modifications that are automatically
 * applied to the OpenAPI schema before client generation.
 *
 * Format: Standard JSON object that gets deeply merged with the original schema.
 *
 * Example:
 * {
 *   "components": {
 *     "schemas": {
 *       "ChartPoints": {
 *         "type": "array",
 *         "prefixItems": [
 *           { "type": "integer", "format": "int64", "description": "Unix timestamp" },
 *           { "type": "number", "description": "Price" }
 *         ],
 *         "items": false
 *       }
 *     }
 *   }
 * }
 *
 * The patch will be applied every time you run `npm run build`.
 * To add new patches, simply edit src/schema-patches.json.
 */
const schemaPatchesPath = path.resolve(process.cwd(), 'src/schema-patches.json');

function downloadSchema(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        https
            .get(url, response => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log('Schema downloaded');
                    resolve();
                });
            })
            .on('error', err => {
                console.error('Error downloading schema');
                reject(err);
            });
    });
}

/**
 * Deep merge two objects with priority to patch values
 */
function deepMerge(target: any, patch: any): any {
    if (patch === null || patch === undefined) {
        return target;
    }

    if (typeof patch !== 'object' || Array.isArray(patch)) {
        return patch;
    }

    const result = { ...target };

    for (const key in patch) {
        if (patch.hasOwnProperty(key)) {
            if (
                typeof patch[key] === 'object' &&
                !Array.isArray(patch[key]) &&
                patch[key] !== null
            ) {
                result[key] = deepMerge(target[key] || {}, patch[key]);
            } else {
                result[key] = patch[key];
            }
        }
    }

    return result;
}

/**
 * Apply patches from schema-patches.json to the downloaded schema
 */
function applySchemaPatches(schemaPath: string, patchesPath: string): void {
    if (!fs.existsSync(patchesPath)) {
        console.log('No schema patches file found, skipping patches');
        return;
    }

    console.log('Applying schema patches...');

    // Read the schema
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = yaml.load(schemaContent) as any;

    // Read the patches
    const patchesContent = fs.readFileSync(patchesPath, 'utf8');
    const patches = JSON.parse(patchesContent);

    // Apply patches
    const patchedSchema = deepMerge(schema, patches);

    // Write back to file
    const yamlOutput = yaml.dump(patchedSchema, {
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
    });

    fs.writeFileSync(schemaPath, yamlOutput, 'utf8');
    console.log('Schema patches applied successfully');
}

function snakeToCamel(snakeCaseString: string): string {
    return snakeCaseString.replace(/(_\w)/g, match => match[1]?.toUpperCase() ?? '');
}

function mapEntries(
    object: Object,
    mapCallbackFn: (entry: [string, any]) => [string, any]
): Object {
    return Object.fromEntries(Object.entries(object).map(mapCallbackFn));
}

function onCreateComponent(component: SchemaComponent) {
    function camelCaseProperties(object: any): any {
        if (Array.isArray(object)) {
            return object.map(camelCaseProperties);
        } else if (typeof object === 'object' && object !== null) {
            if (object.properties) {
                object.properties = camelCaseProperties(object.properties);
            }

            if (object.items) {
                object.items = camelCaseProperties(object.items);
            }

            ['allOf', 'anyOf', 'oneOf'].forEach(keyword => {
                if (object[keyword]) {
                    object[keyword] = camelCaseProperties(object[keyword]);
                }
            });

            if (object.additionalProperties && typeof object.additionalProperties === 'object') {
                object.additionalProperties = camelCaseProperties(object.additionalProperties);
            }

            if (object.required && Array.isArray(object.required)) {
                object.required = object.required.map((key: string) => snakeToCamel(key));
            }

            return mapEntries(object, ([key, value]) => {
                return [snakeToCamel(key), camelCaseProperties(value)];
            });
        } else {
            return object;
        }
    }

    component.rawTypeData = camelCaseProperties(component.rawTypeData);
    return component;
}

const generateApiParams: GenerateApiParams = {
    name: 'src/client.ts',
    output: path.resolve(process.cwd(), './'),
    input: openapiPath,
    templates: path.resolve(process.cwd(), 'src/templates'),
    httpClientType: 'fetch',
    unwrapResponseData: true,
    moduleNameFirstTag: true,
    singleHttpClient: true,
    cleanOutput: false,
    generateClient: true,
    extractResponseBody: true,
    primitiveTypeConstructs: (struct: PrimitiveTypeStruct) => ({
        ...struct,
        integer: {
            $default: 'number',
            bigint: 'bigint'
        },
        string: {
            $default: 'string',
            address: 'Address',
            cell: 'Cell',
            bigint: 'bigint',
            'cell-base64': 'Cell',
            'tuple-item': 'TupleItem',
            'maybe-address': 'Address | null'
        }
    }),
    hooks: {
        onCreateComponent,
        onFormatTypeName: typeName => {
            return typeName === 'TvmStackRecord' ? 'TupleItem' : typeName;
        },
        onPreParseSchema(originalSchema) {
            if (originalSchema.type === 'array' && originalSchema.prefixItems) {
                const { prefixItems, ...rest } = originalSchema;
                return {
                    ...rest,
                    items: prefixItems
                };
            }

            return {
                ...originalSchema,
                format: originalSchema['x-js-format'] ?? originalSchema.format
            };
        }
    },
    // @ts-ignore
    packageVersion
};

async function main() {
    // Download schema and apply patches automatically
    // await downloadSchema(openapiUrl, openapiPath);
    // applySchemaPatches(openapiPath, schemaPatchesPath);

    generateApi(generateApiParams);
}

main();

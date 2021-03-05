// tslint:disable:max-file-line-count
import { SignedOrder } from '@0x/order-utils';
import { BigNumber, NULL_ADDRESS } from '@0x/utils';
import * as chai from 'chai';
import * as HttpStatus from 'http-status-codes';
import * as httpMocks from 'node-mocks-http';
import * as TypeMoq from 'typemoq';

import { ZERO_EX_API_KEY_HEADER_STRING } from '../src/constants';
import { generateApiKeyHandler, submitRequestHandler, takerRequestHandler } from '../src/handlers';
import { parseTakerRequest } from '../src/request_parser';
import {
    Quoter,
    SubmitRequest,
    TakerRequest,
    V3RFQFirmQuote,
    V3RFQIndicativeQuote,
    V4RFQFirmQuote,
    V4SignedRfqOrder,
    VersionedQuote,
} from '../src/types';

const expect = chai.expect;

const fakeV3Order: SignedOrder = {
    chainId: 1,
    exchangeAddress: '0xabc',
    makerAddress: '0xabc',
    takerAddress: '0xabc',
    feeRecipientAddress: '0xabc',
    senderAddress: '',
    makerAssetAmount: new BigNumber(1),
    takerAssetAmount: new BigNumber(1),
    makerFee: new BigNumber(0),
    takerFee: new BigNumber(0),
    expirationTimeSeconds: new BigNumber(1000),
    salt: new BigNumber(1000),
    makerAssetData: '0xabc',
    takerAssetData: '0xabc',
    makerFeeAssetData: '0xabc',
    takerFeeAssetData: '0xabc',
    signature: 'fakeSignature',
};

const fakeV4Order: V4SignedRfqOrder = {
    makerToken: '0xabc',
    takerToken: '0xabc',
    makerAmount: new BigNumber(1),
    takerAmount: new BigNumber(1),
    maker: '0xabc',
    taker: '0xabc',
    txOrigin: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
    pool: '0x0000001',
    expiry: new BigNumber(1000),
    salt: new BigNumber(1000),
    chainId: 1,
    verifyingContract: '0xabc',
    signature: {
        signatureType: 3,
        v: 27,
        r: '0xblah',
        s: '0xblah',
    },
};

describe('parseTakerRequest', () => {
    it('should handle an optional comparisonPrice', () => {
        const query = {
            sellTokenAddress: NULL_ADDRESS,
            buyTokenAddress: NULL_ADDRESS,
            takerAddress: NULL_ADDRESS,
            sellAmountBaseUnits: '1225000000',
            comparisonPrice: '320.12',
        };
        const request = {
            query,
            headers: {
                [ZERO_EX_API_KEY_HEADER_STRING]: '0xfoo',
            },
        };
        const parsedRequest = parseTakerRequest(request);
        if (parsedRequest.isValid && parsedRequest.takerRequest.comparisonPrice) {
            // tslint:disable-next-line: custom-no-magic-numbers
            expect(parsedRequest.takerRequest.comparisonPrice.toNumber()).to.eql(320.12);
        } else {
            expect.fail('Parsed request is not valid or comparisonPrice was not parsed correctly');
        }
    });

    it('should fail validation with an invalid comparison price', () => {
        const query = {
            sellTokenAddress: NULL_ADDRESS,
            buyTokenAddress: NULL_ADDRESS,
            takerAddress: NULL_ADDRESS,
            sellAmountBaseUnits: '1225000000',
            comparisonPrice: 'three twenty',
        };
        const request = {
            query,
            headers: {
                [ZERO_EX_API_KEY_HEADER_STRING]: '0xfoo',
            },
        };
        const parsedRequest = parseTakerRequest(request);
        expect(parsedRequest.isValid).to.eql(false);
    });

    it('should still validate without a comparison price', () => {
        const query = {
            sellTokenAddress: NULL_ADDRESS,
            buyTokenAddress: NULL_ADDRESS,
            takerAddress: NULL_ADDRESS,
            sellAmountBaseUnits: '1225000000',
        };
        const request = {
            query,
            headers: {
                [ZERO_EX_API_KEY_HEADER_STRING]: '0xfoo',
            },
        };
        const parsedRequest = parseTakerRequest(request);
        if (parsedRequest.isValid) {
            expect(parsedRequest.takerRequest.comparisonPrice).to.eql(undefined);
        } else {
            expect.fail('Parsed request is not valid');
        }
    });

    it('should default to v3 requests', () => {
        const query = {
            sellTokenAddress: NULL_ADDRESS,
            buyTokenAddress: NULL_ADDRESS,
            takerAddress: NULL_ADDRESS,
            sellAmountBaseUnits: '1225000000',
        };
        const request = {
            query,
            headers: {
                [ZERO_EX_API_KEY_HEADER_STRING]: '0xfoo',
            },
        };
        const parsedRequest = parseTakerRequest(request);
        if (parsedRequest.isValid) {
            expect(parsedRequest.takerRequest.protocolVersion).to.eql('3');
        } else {
            expect.fail('Parsed request is not valid');
        }
    });

    it('should handle requests where v4 is specified', () => {
        const query = {
            sellTokenAddress: NULL_ADDRESS,
            buyTokenAddress: NULL_ADDRESS,
            takerAddress: NULL_ADDRESS,
            sellAmountBaseUnits: '1225000000',
            protocolVersion: '4',
            txOrigin: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
        };
        const request = {
            query,
            headers: {
                [ZERO_EX_API_KEY_HEADER_STRING]: '0xfoo',
            },
        };
        const parsedRequest = parseTakerRequest(request);
        if (parsedRequest.isValid) {
            if (parsedRequest.takerRequest.protocolVersion === '4') {
                expect(parsedRequest.takerRequest.txOrigin === '0x61935cbdd02287b511119ddb11aeb42f1593b7ef');
            } else {
                expect.fail('Returned protocol version is not 4');
            }
        } else {
            expect.fail('Parsed request is not valid');
        }
    });

    it('should handle v4 requests with isLastLook', () => {
        const query = {
            sellTokenAddress: NULL_ADDRESS,
            buyTokenAddress: NULL_ADDRESS,
            takerAddress: NULL_ADDRESS,
            sellAmountBaseUnits: '1225000000',
            protocolVersion: '4',
            txOrigin: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
            isLastLook: 'true',
        };
        const request = {
            query,
            headers: {
                [ZERO_EX_API_KEY_HEADER_STRING]: '0xfoo',
            },
        };
        const parsedRequest = parseTakerRequest(request);
        if (parsedRequest.isValid) {
            if (parsedRequest.takerRequest.protocolVersion === '4') {
                expect(parsedRequest.takerRequest.isLastLook).to.equal(true);
            } else {
                expect.fail('Returned protocol version is not 4');
            }
        } else {
            expect.fail('Parsed request is not valid');
        }
    });

    it('should fail version with an invalid protocol or txOrigin', () => {
        const tests: { protocolVersion: string; txOrigin?: string; expectedErrorMsg: string }[] = [
            {
                protocolVersion: '4',
                txOrigin: '0xfoo',
                expectedErrorMsg: 'instance.txOrigin does not match pattern "^0x[0-9a-fA-F]{40}$"',
            },
            { protocolVersion: '4', txOrigin: NULL_ADDRESS, expectedErrorMsg: 'V4 queries require a valid "txOrigin"' },
            { protocolVersion: '4', txOrigin: undefined, expectedErrorMsg: 'V4 queries require a valid "txOrigin"' },
            {
                protocolVersion: '5',
                txOrigin: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
                expectedErrorMsg: 'Invalid protocol version: 5.',
            },
        ];
        for (const test of tests) {
            const { protocolVersion, txOrigin, expectedErrorMsg } = test;
            const query = {
                sellTokenAddress: NULL_ADDRESS,
                buyTokenAddress: NULL_ADDRESS,
                takerAddress: NULL_ADDRESS,
                sellAmountBaseUnits: '1225000000',
                protocolVersion,
                ...(txOrigin ? { txOrigin } : {}),
            };
            const request = {
                query,
                headers: {
                    [ZERO_EX_API_KEY_HEADER_STRING]: '0xfoo',
                },
            };
            const parsedRequest = parseTakerRequest(request);
            if (parsedRequest.isValid) {
                expect.fail('Request should be invalid');
            } else {
                expect(parsedRequest.errors[0]).to.eql(expectedErrorMsg);
            }
        }
    });
});

describe('api key handler', () => {
    it('reject when canMakerControlSettlement == false & no API key specified', () => {
        const handler = generateApiKeyHandler();
        const req = httpMocks.createRequest();
        const resp = httpMocks.createResponse();

        handler(req, resp, () => {
            return;
        });

        expect(resp._getStatusCode()).to.eql(HttpStatus.UNAUTHORIZED);
        expect(resp._getJSONData()).to.eql({ errors: ['Invalid API key'] });
    });
    it('accept when canMakerControlSettlement == false & API Key specified', () => {
        const handler = generateApiKeyHandler();
        const req = httpMocks.createRequest({
            headers: { '0x-api-key': 'cde' },
        });
        const resp = httpMocks.createResponse();

        handler(req, resp, () => {
            return;
        });

        expect(resp._getStatusCode()).to.eql(HttpStatus.OK);
    });
    it('accept when canMakerControlSettlement == true & no API Key specified', () => {
        const handler = generateApiKeyHandler();
        const req = httpMocks.createRequest({
            query: {
                canMakerControlSettlement: true,
            },
        });
        const resp = httpMocks.createResponse();

        handler(req, resp, () => {
            return;
        });

        expect(resp._getStatusCode()).to.eql(HttpStatus.OK);
    });
    it('accept when canMakerControlSettlement == true & API Key specified', () => {
        const handler = generateApiKeyHandler();
        const req = httpMocks.createRequest({
            query: {
                canMakerControlSettlement: true,
            },
            headers: { '0x-api-key': 'cde' },
        });
        const resp = httpMocks.createResponse();

        handler(req, resp, () => {
            return;
        });

        expect(resp._getStatusCode()).to.eql(HttpStatus.OK);
    });
});

describe('taker request handler', () => {
    const fakeV3TakerRequest: TakerRequest = {
        buyTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
        sellTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        buyAmountBaseUnits: new BigNumber(1000000000000000000),
        sellAmountBaseUnits: undefined,
        takerAddress: '0x8a333a18B924554D6e83EF9E9944DE6260f61D3B',
        apiKey: 'kool-api-key',
        canMakerControlSettlement: undefined,
        comparisonPrice: undefined,
        protocolVersion: '3',
    };
    const fakeV4TakerRequest: TakerRequest = {
        buyTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
        sellTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        buyAmountBaseUnits: new BigNumber(1000000000000000000),
        sellAmountBaseUnits: undefined,
        takerAddress: '0x8a333a18B924554D6e83EF9E9944DE6260f61D3B',
        apiKey: 'kool-api-key',
        canMakerControlSettlement: undefined,
        comparisonPrice: undefined,
        txOrigin: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
        protocolVersion: '4',
        isLastLook: false,
    };

    it('should defer to quoter and return response for firm quote', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);
        const expectedResponse: VersionedQuote<'3', V3RFQFirmQuote> = {
            response: {
                signedOrder: fakeV3Order,
            },
            protocolVersion: '3',
        };
        quoter
            .setup(async q => q.fetchFirmQuoteAsync(fakeV3TakerRequest))
            .returns(async () => expectedResponse)
            .verifiable(TypeMoq.Times.once());

        const req = httpMocks.createRequest({
            query: {
                buyTokenAddress: fakeV3TakerRequest.buyTokenAddress,
                sellTokenAddress: fakeV3TakerRequest.sellTokenAddress,
                // tslint:disable-next-line: no-non-null-assertion
                buyAmountBaseUnits: fakeV3TakerRequest.buyAmountBaseUnits!.toString(),
                takerAddress: fakeV3TakerRequest.takerAddress,
            },
            headers: { '0x-api-key': fakeV3TakerRequest.apiKey },
        });
        const resp = httpMocks.createResponse();

        await takerRequestHandler('firm', quoter.object, req, resp);

        expect(resp._getStatusCode()).to.eql(HttpStatus.OK);
        expect(resp._getJSONData()).to.eql(JSON.parse(JSON.stringify(expectedResponse.response)));

        quoter.verifyAll();
    });
    it('should succeed without an API key if `canMakerControlSettlement` is set to `true` when requesting a firm quote', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);
        const expectedResponse: VersionedQuote<'3', V3RFQFirmQuote> = {
            response: {
                signedOrder: fakeV3Order,
            },
            protocolVersion: '3',
        };
        const takerRequest = {
            ...fakeV3TakerRequest,
            canMakerControlSettlement: true,
            apiKey: undefined,
        };
        quoter
            .setup(async q => q.fetchFirmQuoteAsync(takerRequest))
            .returns(async () => expectedResponse)
            .verifiable(TypeMoq.Times.once());

        const req = httpMocks.createRequest({
            query: {
                buyTokenAddress: takerRequest.buyTokenAddress,
                sellTokenAddress: takerRequest.sellTokenAddress,
                // tslint:disable-next-line:no-non-null-assertion
                buyAmountBaseUnits: takerRequest.buyAmountBaseUnits!.toString(),
                takerAddress: takerRequest.takerAddress,
                canMakerControlSettlement: takerRequest.canMakerControlSettlement.toString(),
            },
        });
        const resp = httpMocks.createResponse();

        await takerRequestHandler('firm', quoter.object, req, resp);

        expect(resp._getStatusCode()).to.eql(HttpStatus.OK);
        expect(resp._getJSONData()).to.eql(JSON.parse(JSON.stringify(expectedResponse.response)));

        quoter.verifyAll();
    });
    it('should defer to quoter and return response for indicative quote', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);

        const {
            makerAssetData,
            makerAssetAmount,
            takerAssetAmount,
            takerAssetData,
            expirationTimeSeconds,
        } = fakeV3Order;
        const indicativeQuote: VersionedQuote<'3', V3RFQIndicativeQuote> = {
            protocolVersion: '3',
            response: {
                makerAssetData,
                makerAssetAmount,
                takerAssetAmount,
                takerAssetData,
                expirationTimeSeconds,
            },
        };
        quoter
            .setup(async q => q.fetchIndicativeQuoteAsync(fakeV3TakerRequest))
            .returns(async () => indicativeQuote)
            .verifiable(TypeMoq.Times.once());

        const req = httpMocks.createRequest({
            query: {
                buyTokenAddress: fakeV3TakerRequest.buyTokenAddress,
                sellTokenAddress: fakeV3TakerRequest.sellTokenAddress,
                // tslint:disable-next-line: no-non-null-assertion
                buyAmountBaseUnits: fakeV3TakerRequest.buyAmountBaseUnits!.toString(),
                takerAddress: fakeV3TakerRequest.takerAddress,
            },
            headers: { '0x-api-key': fakeV3TakerRequest.apiKey },
        });
        const resp = httpMocks.createResponse();

        await takerRequestHandler('indicative', quoter.object, req, resp);

        expect(resp._getStatusCode()).to.eql(HttpStatus.OK);
        expect(resp._getJSONData()).to.eql(JSON.parse(JSON.stringify(indicativeQuote.response)));

        quoter.verifyAll();
    });
    it('should handle empty indicative quote', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);
        quoter
            .setup(async q => q.fetchIndicativeQuoteAsync(fakeV3TakerRequest))
            .returns(async () => {
                return { protocolVersion: '3', response: undefined };
            })
            .verifiable(TypeMoq.Times.once());

        const req = httpMocks.createRequest({
            query: {
                buyTokenAddress: fakeV3TakerRequest.buyTokenAddress,
                sellTokenAddress: fakeV3TakerRequest.sellTokenAddress,
                // tslint:disable-next-line:no-non-null-assertion
                buyAmountBaseUnits: fakeV3TakerRequest.buyAmountBaseUnits!.toString(),
                takerAddress: fakeV3TakerRequest.takerAddress,
            },
            headers: { '0x-api-key': fakeV3TakerRequest.apiKey },
        });
        const resp = httpMocks.createResponse();

        await takerRequestHandler('indicative', quoter.object, req, resp);

        expect(resp._getStatusCode()).to.eql(HttpStatus.NO_CONTENT);

        quoter.verifyAll();
    });
    it('should handle empty firm quote', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);
        quoter
            .setup(async q => q.fetchFirmQuoteAsync(fakeV3TakerRequest))
            .returns(async () => {
                return { protocolVersion: '3', response: undefined };
            })
            .verifiable(TypeMoq.Times.once());

        const req = httpMocks.createRequest({
            query: {
                buyTokenAddress: fakeV3TakerRequest.buyTokenAddress,
                sellTokenAddress: fakeV3TakerRequest.sellTokenAddress,
                // tslint:disable-next-line:no-non-null-assertion
                buyAmountBaseUnits: fakeV3TakerRequest.buyAmountBaseUnits!.toString(),
                takerAddress: fakeV3TakerRequest.takerAddress,
            },
            headers: { '0x-api-key': fakeV3TakerRequest.apiKey },
        });
        const resp = httpMocks.createResponse();

        await takerRequestHandler('firm', quoter.object, req, resp);

        expect(resp._getStatusCode()).to.eql(HttpStatus.NO_CONTENT);

        quoter.verifyAll();
    });
    it('should invalidate a bad request', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);

        const req = httpMocks.createRequest({
            query: {
                sellTokenAddress: fakeV3TakerRequest.sellTokenAddress,
                // tslint:disable-next-line:no-non-null-assertion
                buyAmountBaseUnits: fakeV3TakerRequest.buyAmountBaseUnits!.toString(),
                takerAddress: fakeV3TakerRequest.takerAddress,
            },
            headers: { '0x-api-key': fakeV3TakerRequest.apiKey },
        });
        const resp = httpMocks.createResponse();

        await takerRequestHandler('firm', quoter.object, req, resp);
        expect(resp._getStatusCode()).to.eql(HttpStatus.BAD_REQUEST);
        const returnedData = resp._getJSONData();
        expect(Object.keys(returnedData)).to.eql(['errors']);
        expect(returnedData.errors.length).to.eql(1);
        expect(returnedData.errors[0]).to.eql('instance requires property "buyTokenAddress"');
    });
    it('should handle a valid v4 request', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);
        const expectedResponse: VersionedQuote<'4', V4RFQFirmQuote> = {
            response: {
                signedOrder: fakeV4Order,
            },
            protocolVersion: '4',
        };
        quoter
            .setup(async q => q.fetchFirmQuoteAsync(fakeV4TakerRequest))
            .returns(async () => expectedResponse)
            .verifiable(TypeMoq.Times.once());

        const req = httpMocks.createRequest({
            query: {
                buyTokenAddress: fakeV4TakerRequest.buyTokenAddress,
                sellTokenAddress: fakeV4TakerRequest.sellTokenAddress,
                // tslint:disable-next-line:no-non-null-assertion
                buyAmountBaseUnits: fakeV4TakerRequest.buyAmountBaseUnits!.toString(),
                takerAddress: fakeV4TakerRequest.takerAddress,
                txOrigin: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
                protocolVersion: '4',
            },
            headers: { '0x-api-key': fakeV4TakerRequest.apiKey },
        });
        const resp = httpMocks.createResponse();

        await takerRequestHandler('firm', quoter.object, req, resp);

        expect(resp._getStatusCode()).to.eql(HttpStatus.OK);
        expect(resp._getJSONData()).to.eql(JSON.parse(JSON.stringify(expectedResponse.response)));

        quoter.verifyAll();
    });
});

describe('submit request handler', () => {
    const zeroExTransaction = {
        data:
            '0x8bc8efb300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000000000000000034000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000cb744534a44083acd8c3b0b0b2d6e06faa50b9aa0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a258b39954cef5cb142fd567a46cddb31a6701240000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000069457702803400000000000000000000000000000000000000000000000000007a1fe160277000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005eb5173600000000000000000000000000000000000000000000000000000171bfeb2a4900000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000024f47261b0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024f47261b00000000000000000000000009f8f72aa9304c8b593d555f12ef6589cc3a579a20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000421cee48f5cc8bf3f1c1d0f06d724c24fc907859af20cabb9fc6e97938ddaca27b7a638f7b2bf90dd21aa267e5bc89feca1dcc9703f0469a52fc77d554e85861d76003000000000000000000000000000000000000000000000000000000000000',
        salt: new BigNumber('77292819507578364752487536887331696181649044658387068392183080209514782056821'),
        signerAddress: '0x75be4f78aa3699b3a348c84bdb2a96c3dbb5e2ef',
        gasPrice: new BigNumber(16000000000),
        expirationTimeSeconds: new BigNumber(1588762397),
        domain: {
            chainId: 1,
            verifyingContract: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
        },
    };
    const signature =
        '0x1bee9981f3b24eaebed1b1af822fc91cbab9f5e3567a1291d09bcb02129a51252808c9db2c770a7120bf54e52f088e5b34b6d8abe84e1960fa1a37b8372bd1d49703';
    const fakeSubmitRequest: SubmitRequest = {
        zeroExTransaction,
        signature,
        apiKey: 'kool-api-key',
    };

    const expectedSuccessResponse = {
        ethereumTransactionHash: '0x3ab9fa039c0152398421988b40640299862213f2ec71876262cd9dd5fff4d2a8',
        signedEthereumTransaction:
            '0xf906120e8503b9aca00083037a989461935cbdd02287b511119ddb11aeb42f1593b7ef870886c98b760000b905a42280c91000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000520aae22f7f36feb12ac171d654beb2cb01cfd1269fd14cbc0d19b5449c7dace175000000000000000000000000000000000000000000000000000000005eb2971d00000000000000000000000000000000000000000000000000000003b9aca00000000000000000000000000075be4f78aa3699b3a348c84bdb2a96c3dbb5e2ef00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000004048bc8efb300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000000000000000034000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000cb744534a44083acd8c3b0b0b2d6e06faa50b9aa0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a258b39954cef5cb142fd567a46cddb31a6701240000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000069457702803400000000000000000000000000000000000000000000000000007a1fe160277000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005eb5173600000000000000000000000000000000000000000000000000000171bfeb2a4900000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000024f47261b0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024f47261b00000000000000000000000009f8f72aa9304c8b593d555f12ef6589cc3a579a20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000421cee48f5cc8bf3f1c1d0f06d724c24fc907859af20cabb9fc6e97938ddaca27b7a638f7b2bf90dd21aa267e5bc89feca1dcc9703f0469a52fc77d554e85861d760030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000421bee9981f3b24eaebed1b13f828fc91cbab9f5e356701291d09bcba2129a51252808c9db2c770e7120bf54e52f088e5b34b6d8abe84e1960fa1a37b8372bd1d4970300000000000000000000000000000000000000000000000000000000000025a01fd71a2237d9af0cfed0560102ddf22b546dce41db58e05a268504be8df34221a023b0684734d040d7730a39e58a5052fdca1faf68a3b522dbb10f178523f771f4',
    };

    it('should defer to quoter and return response for submit request', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);
        quoter
            .setup(async q => q.submitFillAsync(fakeSubmitRequest))
            .returns(async () => expectedSuccessResponse)
            .verifiable(TypeMoq.Times.once());

        const req = httpMocks.createRequest({
            body: {
                zeroExTransaction,
                signature,
            },
            headers: { '0x-api-key': fakeSubmitRequest.apiKey },
        });
        const resp = httpMocks.createResponse();

        await submitRequestHandler(quoter.object, req, resp);

        expect(resp._getStatusCode()).to.eql(HttpStatus.OK);
        expect(resp._getJSONData()).to.eql(JSON.parse(JSON.stringify(expectedSuccessResponse)));

        quoter.verifyAll();
    });
    it('should succeed without an API key when submitting a fill', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);
        const fakeSubmitRequestWithoutApiKey = {
            ...fakeSubmitRequest,
            apiKey: undefined,
        };
        quoter
            .setup(async q => q.submitFillAsync(fakeSubmitRequestWithoutApiKey))
            .returns(async () => expectedSuccessResponse)
            .verifiable(TypeMoq.Times.once());

        const req = httpMocks.createRequest({
            body: {
                zeroExTransaction,
                signature,
            },
        });
        const resp = httpMocks.createResponse();

        await submitRequestHandler(quoter.object, req, resp);

        expect(resp._getStatusCode()).to.eql(HttpStatus.OK);
        expect(resp._getJSONData()).to.eql(JSON.parse(JSON.stringify(expectedSuccessResponse)));

        quoter.verifyAll();
    });
    it('should invalidate a bad request', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);

        const req = httpMocks.createRequest({
            body: {
                zeroExTransaction,
            },
            headers: { '0x-api-key': fakeSubmitRequest.apiKey },
        });
        const resp = httpMocks.createResponse();

        await submitRequestHandler(quoter.object, req, resp);
        expect(resp._getStatusCode()).to.eql(HttpStatus.BAD_REQUEST);
        const returnedData = resp._getJSONData();
        expect(Object.keys(returnedData)).to.eql(['errors']);
        expect(returnedData.errors.length).to.eql(1);
        expect(returnedData.errors[0]).to.eql('instance requires property "signature"');
    });
    it('should handle empty indicative quote', async () => {
        const quoter = TypeMoq.Mock.ofType<Quoter>(undefined, TypeMoq.MockBehavior.Strict);
        quoter
            .setup(async q => q.submitFillAsync(fakeSubmitRequest))
            .returns(async () => undefined)
            .verifiable(TypeMoq.Times.once());

        const req = httpMocks.createRequest({
            body: {
                zeroExTransaction,
                signature,
            },
            headers: { '0x-api-key': fakeSubmitRequest.apiKey },
        });
        const resp = httpMocks.createResponse();

        await submitRequestHandler(quoter.object, req, resp);

        expect(resp._getStatusCode()).to.eql(HttpStatus.NO_CONTENT);

        quoter.verifyAll();
    });
});

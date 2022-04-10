const assert = require('assert');
const { ethers } = require('ethers');
const { deploy } = require('../lib/solc_util');
const { getWallet } = require('../lib/accounts')
const RPC = process.env.RPC || "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider({ url: RPC, timeout: 6000 })

let wallet

describe('VDF raw', function () {
    before(async () => {
        wallet = await getWallet(__filename, provider)
    })

    let vdf

    before(async function () {
        vdf = await deploy(`
            function verify(bytes memory input) external returns (bool valid) {
                uint len = input.length;
                uint success;
                assembly {
                    // call ecmul precompile
                    success := call(
                        not(0),
                        0xF1,               // vdfVerify pre-compiled
                        0,                  // ETH value
                        add(input, 0x20),   // skip the first word, reserved for input length
                        len,
                        0x00,               // scratch space
                        0x20
                    )
                    valid := mload(0x00)    // copy result from scrach space to return variable
                }
                if (success == 0) {
                    revert("invalid VDF input");
                }
            }
        `, wallet)
    });


    it('invalid missing everything', async function () {
        await assert.rejects(vdf.callStatic.verify('0x'), {reason: "invalid VDF input"})

        const res = await vdf.verify('0x', { gasLimit: 80000 });
        await assert.rejects(res.wait(1), { reason: 'transaction failed' });
    });

    it('invalid missing output', async function () {
        const input = '0x' +
            '55b6a7e73c57d1ca35b35cad22869eaa33e10fa2a822fb7308f419269794d611' +
            '0000000000000800' +
            '0000000000000400';

        await assert.rejects(vdf.callStatic.verify(input), {reason: "invalid VDF input"})

        const res = await vdf.verify(input, { gasLimit: 80000 });

        await assert.rejects(res.wait(1), { reason: 'transaction failed' });
    });


    it('invalid bitSize', async function () {
        const input = '0x' +
            '55b6a7e73c57d1ca35b35cad22869eaa33e10fa2a822fb7308f419269794d611' +
            '0000000000000810' +
            '0000000000000400' +
            '007b6b46c642f47b8b38b45d80eea2b24f76f12fa270995112344703c45cda62b547194e97ca1ca1153cd9b276abc983d663f09a5f8c56f99ce6acf5cda7b567a3b30b9eeb91b4587fdb67462bce5993ecbc1d500a502daf07259edb3a8a2a4769e56dd6b36657879e81b3677ecf19b89b9b441204be5d93c4d9d60997e38eba62ff976a65fdca18207004d347cb15193debb10d19087902d7ca92c9685276481d499ef0358901f693f262bd5126d2b39166dd3a81bd8ec09fe8634a7f95a1e9db049495702090ef7065196082bf2fb92b3a5948f667372027feff988a560a3f40def6ab53f81c2c021f246efa5da92e2f9c528ba5bbd9279d569d643d369f10469f0044124b8359a5b425526a6dca3e9f51fed227c462b6744eab9fdf2b7326720cb31c9a3a3d885ee9d3e089df2d14da69b986504fd9ecb10c41d92aa24b861dcbe0fce4cc7386992a6f6872b8cc2ce0f125326ad38f55fdf72aeb21a84b9d95b7d8693d46582163bcb4fc957925aa61f1dd5b36c27de5b1cd602372637adb3a2554000e98ef2094415adf4958f147147bb04c1305ba05d0833e8d925381e4978e25b2d6aeffe76e4b36a322e2154f39baad4cd1c0b2b2c1be83bc1d49effe6d0729937b34a18137026909ce169f76e2cd711c4c458d4f0aed4dd2d6bd9b931e2c71f8d0bf8950fefafcdc02c0edd56883dcc8421bfa0d0d21e92a9fc0184762799e9b'


        await assert.rejects(vdf.callStatic.verify(input), {reason: "invalid VDF input"})

        const res = await vdf.verify(input, { gasLimit: 80000 });
        await assert.rejects(res.wait(1), { reason: 'transaction failed' });
    });



    it('invalid output length', async function () {
        const input = '0x' +
            '55b6a7e73c57d1ca35b35cad22869eaa33e10fa2a822fb7308f419269794d611' +
            '0000000000000800' +
            '0000000000000400' +
            '007b6b46c642f47b8b38b45d80eea2b24f76f12fa270995112344703c45cda62b547194e97ca1ca1153cd9b276abc983d663f09a5f8c56f99ce6acf5cda7b567a3b30b9eeb91b4587fdb67462bce5993ecbc1d500a502daf07259edb3a8a2a4769e56dd6b36657879e81b3677ecf19b89b9b441204be5d93c4d9d60997e38eba62ff976a65fdca18207004d347cb15193debb10d19087902d7ca92c9685276481d499ef0358901f693f262bd5126d2b39166dd3a81bd8ec09fe8634a7f95a1e9db049495702090ef7065196082bf2fb92b3a5948f667372027feff988a560a3f40def6ab53f81c2c021f246efa5da92e2f9c528ba5bbd9279d569d643d369f10469f0044124b8359a5b425526a6dca3e9f51fed227c462b6744eab9fdf2b7326720cb31c9a3a3d885ee9d3e089df2d14da69b986504fd9ecb10c41d92aa24b861dcbe0fce4cc7386992a6f6872b8cc2ce0f125326ad38f55fdf72aeb21a84b9d95b7d8693d46582163bcb4fc957925aa61f1dd5b36c27de5b1cd602372637adb3a2554000e98ef2094415adf4958f147147bb04c1305ba05d0833e8d925381e4978e25b2d6aeffe76e4b36a322e2154f39baad4cd1c0b2b2c1be83bc1d49effe6d0729937b34a18137026909ce169f76e2cd711c4c458d4f0aed4dd2d6bd9b931e2c71f8d0bf8950fefafcdc02c0edd56883dcc8421bfa0d0d21e92a9fc0184762799e9b13';

        await assert.rejects(vdf.callStatic.verify(input), {reason: "invalid VDF input"})

        const res = await vdf.verify(input, { gasLimit: 80000 });
        await assert.rejects(res.wait(1), { reason: 'transaction failed' });
    });


    it('invalid proof', async function () {
        const input = '0x' +
            '55b6a7e73c57d1ca35b35cad22869eaa33e10fa2a822fb7308f419269794d611' +
            '0000000000000800' +
            '0000000000000400' +
            '007b6b46c642f47b8b38b45d80eea2b24f76f12fa270995112344703c45cda62b547194e97ca1ca1153cd9b276abc983d663f09a5f8c56f99ce6acf5cda7b567a3b30b9eeb91b4587fdb67462bce5993ecbc1d500a502daf07259edb3a8a2a4769e56dd6b36657879e81b3677ecf19b89b9b441204be5d93c4d9d60997e38eba62ff976a65fdca18207004d347cb15193debb10d19087902d7ca92c9685276481d499ef0358901f693f262bd5126d2b39166dd3a81bd8ec09fe8634a7f95a1e9db049495702090ef7065196082bf2fb92b3a5948f667372027feff988a560a3f40def6ab53f81c2c021f246efa5da92e2f9c528ba5bbd9279d569d643d369f10469f0044124b8359a5b425526a6dca3e9f51fed227c462b6744eab9fdf2b7326720cb31c9a3a3d885ee9d3e089df2d14da69b986504fd9ecb10c41d92aa24b861dcbe0fce4cc7386992a6f6872b8cc2ce0f125326ad38f55fdf72aeb21a84b9d95b7d8693d46582163bcb4fc957925aa61f1dd5b36c27de5b1cd602372637adb3a2554000e98ef2094415adf4958f147147bb04c1305ba05d0833e8d925381e4978e25b2d6aeffe76e4b36a322e2154f39baad4cd1c0b2b2c1be83bc1d49effe6d0729937b34a18137026909ce169f76e2cd711c4c458d4f0aed4dd2d6bd9b931e2c71f8d0bf8950fefafcdc02c0edd56883dcc8421bfa0d0d21e92a9fc0184762799e9c';

        assert(await vdf.callStatic.verify(input))

        const res = await vdf.verify(input, { gasLimit: 80000 });
        await assert.rejects(res.wait(1), { reason: 'transaction failed' });
    });


    it('valid proof', async function () {
        const input = '0x' +
            '55b6a7e73c57d1ca35b35cad22869eaa33e10fa2a822fb7308f419269794d611' +
            '0000000000000800' +
            '0000000000000400' +
            '007b6b46c642f47b8b38b45d80eea2b24f76f12fa270995112344703c45cda62b547194e97ca1ca1153cd9b276abc983d663f09a5f8c56f99ce6acf5cda7b567a3b30b9eeb91b4587fdb67462bce5993ecbc1d500a502daf07259edb3a8a2a4769e56dd6b36657879e81b3677ecf19b89b9b441204be5d93c4d9d60997e38eba62ff976a65fdca18207004d347cb15193debb10d19087902d7ca92c9685276481d499ef0358901f693f262bd5126d2b39166dd3a81bd8ec09fe8634a7f95a1e9db049495702090ef7065196082bf2fb92b3a5948f667372027feff988a560a3f40def6ab53f81c2c021f246efa5da92e2f9c528ba5bbd9279d569d643d369f10469f0044124b8359a5b425526a6dca3e9f51fed227c462b6744eab9fdf2b7326720cb31c9a3a3d885ee9d3e089df2d14da69b986504fd9ecb10c41d92aa24b861dcbe0fce4cc7386992a6f6872b8cc2ce0f125326ad38f55fdf72aeb21a84b9d95b7d8693d46582163bcb4fc957925aa61f1dd5b36c27de5b1cd602372637adb3a2554000e98ef2094415adf4958f147147bb04c1305ba05d0833e8d925381e4978e25b2d6aeffe76e4b36a322e2154f39baad4cd1c0b2b2c1be83bc1d49effe6d0729937b34a18137026909ce169f76e2cd711c4c458d4f0aed4dd2d6bd9b931e2c71f8d0bf8950fefafcdc02c0edd56883dcc8421bfa0d0d21e92a9fc0184762799e9b';

        assert(await vdf.callStatic.verify(input));

        const res = await vdf.verify(input, { gasLimit: 8000000 });
        assert(res != null, 'rpc response');
        const rec = await res.wait(1);
        assert.equal(rec?.status, 1, 'receipt status');
    });


    it('valid proof 613 6013', async function () {
        const input = '0x' +
            '55b6a7e73c57d1ca35b35cad22869eaa33e10fa2a822fb7308f419269794d611' +
            '0000000000000265' +
            '000000000000177d' +
            '00523e695c0ca5de480d7c98ec6335c818b5ca61ab2b0998e26205b2cacaa22f2bc7e06c48c4e7002e16255e0804c997452af76ae30faac01c3731e7025239b8974d5fd4c0a32a474e474602d78d00eb2c0fd8612aca9e3456c5e26840b91d0fa54a589e433391af48cf5900b2509999e8b287246400d6edf75e01f210871ff79d72afdeb7fe472f3ef5fd1110845f2a780bf1439bd99ee3960671c7';

        assert(await vdf.callStatic.verify(input));

        const res = await vdf.verify(input, { gasLimit: 8000000 });
        assert(res != null, 'rpc response');
        const rec = await res.wait(1);
        assert.equal(rec?.status, 1, 'receipt status');
    });


    it('send with gasLimit', async function () {
        const res = await vdf.verify('0x' +
            '55b6a7e73c57d1ca35b35cad22869eaa33e10fa2a822fb7308f419269794d611' +
            '0000000000000800' +
            '0000000000000800' +
            '001829e155791e12d2894feb643a42d941ba623f266d71a5f56b502f9d5f3ba5b18f745d411886e8c06bbf562d321477f4924e99ac0fe8a797ac554dde9e7ace6db570cb3a5ee797aa9dead6d6b5a0d990a884d5cebd61a077c9bab578264d34b81097f88a1d842e60184b25523f4f934090b08549d6f8deffd5b7df0f510eac38000c702571d7f6cbdd5d743955b3a91fc9d3887f57a078b20c69d5abc1cfc24f3da766dfb2351f71828fe364b88038f12c30a424b8e61a38c37c0512bcb4320a53fa014c19529d09194ff5ed979e427a5b5563846bfa0a8f75b86b8f099f3e0cbc1a84d8fa2dca3eba5e8442a5c9c8e18175c7ef79aa5ac5f733d63d793a4c3fa300181c1dc35714a424273c1bc1ff0ed286131eb7e382bc138512370fb003069a818608cbf38278073d969ee8ac98e556f848ec8b191271005843f453d2c73e1f375d4fa57faffcbadf5f65ea7ac180dc94ee88224fe16c8161e4aa906150da760c3901255979bc49ae296d1015df5fbc29a0bc1c87860bda085fbfe453fb9d6c0affebf47fd0bdc8fd85ab27f6a020e6e943010101e350106870d382e3381f47d74cea6ff6e134267c4466a2799d476b5bef97238a6fe7ce522151003cec2feddfcf2a78f56ba56a5c0df2b60f262d34a980b6d64a955e6129382d19bea9ea6cc05212b3a9d66670e6fcd36fd1cd0a33e226c3a8ef09204713cec14fadbaa633b07b',
            { gasLimit: 8000000 }
        )
        assert(res != null, 'rpc response')
        const rec = await res.wait(1)
        assert.equal(rec?.status, 1, 'receipt status')
    });


    it('estimate gas', async function () {
        const gas = await vdf.estimateGas.verify('0x' +
            '55b6a7e73c57d1ca35b35cad22869eaa33e10fa2a822fb7308f419269794d611' +
            '0000000000000800' +
            '0000000000000C00' +
            '00071a1bef8bc5eae408761e81e1a23e530193bc81042040f62e755a6c4a0ec559de9bedf7277f3e135f047a5486abf7ca78628a3f249df5f695a2585763f90a5a413d14e3fbd4712759b96ae92839a9b6cff2c58d15b8fe2f1d1e69e0916970d18cdbd701739c9cc33ce2a1630e8d90354d31f86ad3ec49b4608cc9c60eaea30000019f56b80b38400ced418d4a719e80a1a7cbb17033d5e6f0e59b6f07e8115697233bb0fea4d426a83e7808f85342cc9b97f1fd904fae8cb57bd145df721a895a0fe4dead8d049856eddb26116b916c7c1beeed0b81bc1a92ef2f2e9bc554c782d0027a802b160cae71f19c0b701121bbb2be1cfe6cd0e998b84d292414d5ee930027652c8d9a85876093b7ee74345c4ae0f0c1684348b43383f86501518e570732a1b2f775956e8e1cba97ec4fa069d611f7e51a4f3ac125dc5fa46cdbb565cc59073a7a1234c84b9120ac106de119415f308c9e82d29a8d05cb53a6c86c5c6c6f9a47585b822ab21df9e396cba514d5fa74a698af7fa667370edcbfc6fcf2024c000887ec327b2391cfd626ee92a3346bf8b65039516c1e4231c93d334b4bf2c66c10917b1318ea814221f808ff493c167ee2c04d1c7a8120ca50913b91a665ab15d503c5ece2ec853e82426c40ecc27d8cc38e3d1d8a766b2f0ef94fe28d118d0eabb6946b1cce7dde3d175de3d2070ff81eebe0d1a73e8fc10c5e8ff6bf02d6f3',
        )
        assert.equal(gas.toString(), '5374856', 'estimated gas')
    });


    it('send without gasLimit', async function () {
        const res = await vdf.verify('0x' +
            '55b6a7e73c57d1ca35b35cad22869eaa33e10fa2a822fb7308f419269794d611' +
            '0000000000000800' +
            '0000000000001000' +
            '00368c942bc4404bd3502cc8d1f0d879b8a1f0cb919984f2e94ac8b4454a9dec9de49230b6ce17a18acd108eb6951c1d1de487e2aae133fb60dd5a1dead4d54d2955a2c7a4304dc40b1f086d95a4ede4af479d63eeafc58d64634e8fa546ed648ba1bf64904bd4ea9ea7e00a5aeba5bba62181199a8acd460081ccfcd509838c6b0022da838618d56aef3dc370b93fc5b5194d9da6ffde0057d558f6894eb692215604012beebd5067dda2e9853bd95d1ebf3df177038ae3fa99aeafe13969b5f3a208593124b48a9e57fc84858ce392bf8e22fc5e538e31b7959dc22494bd31949b3e967eb2f493792eca07fd9aed9aa9055d0b825d758ed5dfafd2d78de4b0ede10013f6f3b876ded2c5e381a27485400b0c3c8b6651f08b225123773d6928a5a99c62236969550ff083662270e0b5325dfc47bd5cf36a381e2250c7acb2fe17f999e9d22e9e3d57d2b33c6754ff45663344dc55f5d3c9f514e0da5fd78292cb4cb48e0d549dc556869fb202d77dddcb7dfbe480702ef640004cc3305d6ee7064d8dffed6ecbce632ffee55712f681246065507a6c798619730672aca544e9144b658acce873a882454e31f6fa0d38912e4fe3631381460b304976306e4f37e3c80a39807f66f63641581f059884d3cf0b4d1aff981fee64366e2c8a33bd84289ddf23223ee749e6f7dd5f7346b50b1ba15e0ea73c8219e3b8ef9528917affa2a8b6e5',
            { gasLimit: 80000 })

        const rec = await res.wait(1)
            .then(() => assert(false, "call must not success"))
            .catch((err) => { })
    });

});

describe('VDF with params', function () {
    let vdf
    before(async function () {
        vdf = await deploy(`function verify(
            bytes32 seed,
            uint64 bitSize,
            uint64 iteration,
            bytes calldata output
        ) external returns (bool valid) {
            bytes memory input = abi.encodePacked(seed, bitSize, iteration, output);
            uint len = input.length;
            uint success;
            assembly {
                // call ecmul precompile
                success := call(
                    not(0),
                    0xF1,               // vdfVerify pre-compiled
                    0,                  // ETH value
                    add(input, 0x20),   // skip the first word, reserved for input length
                    len,
                    0x00,               // scratch space
                    0x20
                )
                valid := mload(0x00)    // copy result from scrach space to return variable
            }
            if (success == 0) {
                revert("invalid VDF input");
            }
        }`, wallet)
    });

    it('send with params', async function () {
        const res = await vdf.verify(
            '0x55b6a7e73c57d1ca35b35cad22869eaa33e10fa2a822fb7308f419269794d611',
            2048,
            4096,
            '0x00368c942bc4404bd3502cc8d1f0d879b8a1f0cb919984f2e94ac8b4454a9dec9de49230b6ce17a18acd108eb6951c1d1de487e2aae133fb60dd5a1dead4d54d2955a2c7a4304dc40b1f086d95a4ede4af479d63eeafc58d64634e8fa546ed648ba1bf64904bd4ea9ea7e00a5aeba5bba62181199a8acd460081ccfcd509838c6b0022da838618d56aef3dc370b93fc5b5194d9da6ffde0057d558f6894eb692215604012beebd5067dda2e9853bd95d1ebf3df177038ae3fa99aeafe13969b5f3a208593124b48a9e57fc84858ce392bf8e22fc5e538e31b7959dc22494bd31949b3e967eb2f493792eca07fd9aed9aa9055d0b825d758ed5dfafd2d78de4b0ede10013f6f3b876ded2c5e381a27485400b0c3c8b6651f08b225123773d6928a5a99c62236969550ff083662270e0b5325dfc47bd5cf36a381e2250c7acb2fe17f999e9d22e9e3d57d2b33c6754ff45663344dc55f5d3c9f514e0da5fd78292cb4cb48e0d549dc556869fb202d77dddcb7dfbe480702ef640004cc3305d6ee7064d8dffed6ecbce632ffee55712f681246065507a6c798619730672aca544e9144b658acce873a882454e31f6fa0d38912e4fe3631381460b304976306e4f37e3c80a39807f66f63641581f059884d3cf0b4d1aff981fee64366e2c8a33bd84289ddf23223ee749e6f7dd5f7346b50b1ba15e0ea73c8219e3b8ef9528917affa2a8b6e5',
            { gasLimit: 8000000 })
        assert(res != null, 'rpc response')
        const rec = await res.wait(1)
        assert.equal(rec?.status, 1, 'receipt status')
        assert.equal(rec?.gasUsed?.toString(), '5292795', 'used gas')
    });

});

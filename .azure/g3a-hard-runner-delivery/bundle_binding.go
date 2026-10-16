package main

const bundleSHA = "ac9f152a2e0eabc26efd13fb7c19be8e6237f37af9ae1680e47e2904a1fde961"
const bundleBytes int64 = 293191680
const candidateSHA = "9889228f05e27a95593ba02e44e54127985175d4748bf98e0c6600bb662d1273"
const candidateBytes int64 = 28094588
const contractSHA = "043faf5dc2eab0d14b1ecd06fd6f0b3c33ae27d25e2dbc2e1238ecdc7c5f32e9"

var boundFiles = []fileSpec{
	{"ca-certificates.crt", 181724, "028fca5150ee1915c4474489985d55c54fceaa680c754cc8d1301734f01b2232", 0o444},
	{"compressor-go1256", 2166932, "378bacae9bd14e6d2c428fb52ea537ae06bedae01392849293ba9863eb62f95c", 0o555},
	{"config-template.json", 1131, "905dccbd2a9da110a68dcbfb17704b205eb10dfb326e51ace2a7db9bc5d3801e", 0o444},
	{"controller-compressor.go", 1733, "54e1367e9435fac7040a05d9b9c6307e6cd65a224827451e2e350abbbf059442", 0o444},
	{"controller-go.mod", 48, "3689d09b0cc8743498b34b70db4318d5ca5a6a0fc90f1dfad38c47b9e04c8418", 0o444},
	{"controller-main.go", 16390, "2abc8b0c9b12d9a40da5049710f9b52efd5672602a891bb2a1c5d78faa34875e", 0o444},
	{"controller-main_test.go", 4020, "9a93c65c68ad10e5d79cf9925455c2892591298c3c826a3e5c32e3c6477aca81", 0o444},
	{"g3a-final-runner", 28094588, "9889228f05e27a95593ba02e44e54127985175d4748bf98e0c6600bb662d1273", 0o500},
	{"go-toolchain.tar", 256931840, "51b46bff38e67af357d70f68215f862fd3ee9d4b25457a78d44d108b4a17ed4e", 0o444},
	{"index-template.json", 599, "a9b061637c76b7680ac5d1f682e0ab8abe507474ccc835eefcb5dee18a1f7a12", 0o444},
	{"manifest-template.json", 840, "82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7", 0o444},
	{"portable-assembler", 3473532, "3b444e003474b5717ff549c5cafaf9cb761835eea3b4844e1344aa9e61581da4", 0o555},
	{"private-reader.py", 12907, "c7ac915a4b5d295eb23f55a5ceea801a4f9a0bcaded04e7839a30a7a0743bc68", 0o444},
	{"source-manifest.json", 447, "14423845fbe66427e747acbfa07bf97ed59ff0fb0f89570630f2a9d2ee70c430", 0o444},
	{"source.tar", 40960, "257494861aa941b7289d1284100edd8999c53917437426bf82acdabc257fed24", 0o444},
	{"toolchain-members.json", 2243946, "f45f0315a99fd11f95a993d9f5474ea7459a8ffe52fd7171008ce6a4a0a3b103", 0o444},
}

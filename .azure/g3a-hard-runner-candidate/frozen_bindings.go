package main

type frozenInput struct {
	Bytes int64
	SHA   string
}

const frozenInputSpecSHA256 = "247cd5aed0a3154891a5f966992c10e6a6d319c0f1554887c99aaa3f3c3572d3"

var frozenInputs = map[string]frozenInput{
	"ca-certificates.crt":      {181724, "028fca5150ee1915c4474489985d55c54fceaa680c754cc8d1301734f01b2232"},
	"compressor-go1256":        {2166932, "378bacae9bd14e6d2c428fb52ea537ae06bedae01392849293ba9863eb62f95c"},
	"config-template.json":     {1131, "905dccbd2a9da110a68dcbfb17704b205eb10dfb326e51ace2a7db9bc5d3801e"},
	"controller-compressor.go": {1733, "54e1367e9435fac7040a05d9b9c6307e6cd65a224827451e2e350abbbf059442"},
	"controller-go.mod":        {48, "3689d09b0cc8743498b34b70db4318d5ca5a6a0fc90f1dfad38c47b9e04c8418"},
	"controller-main.go":       {16390, "2abc8b0c9b12d9a40da5049710f9b52efd5672602a891bb2a1c5d78faa34875e"},
	"controller-main_test.go":  {4020, "9a93c65c68ad10e5d79cf9925455c2892591298c3c826a3e5c32e3c6477aca81"},
	"go-toolchain.tar":         {256931840, "51b46bff38e67af357d70f68215f862fd3ee9d4b25457a78d44d108b4a17ed4e"},
	"index-template.json":      {599, "a9b061637c76b7680ac5d1f682e0ab8abe507474ccc835eefcb5dee18a1f7a12"},
	"manifest-template.json":   {840, "82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7"},
	"portable-assembler":       {3473532, "3b444e003474b5717ff549c5cafaf9cb761835eea3b4844e1344aa9e61581da4"},
	"private-reader.py":        {12907, "c7ac915a4b5d295eb23f55a5ceea801a4f9a0bcaded04e7839a30a7a0743bc68"},
	"source-manifest.json":     {447, "14423845fbe66427e747acbfa07bf97ed59ff0fb0f89570630f2a9d2ee70c430"},
	"source.tar":               {40960, "257494861aa941b7289d1284100edd8999c53917437426bf82acdabc257fed24"},
	"toolchain-members.json":   {2243946, "f45f0315a99fd11f95a993d9f5474ea7459a8ffe52fd7171008ce6a4a0a3b103"},
}

var exactOutputs = map[string]string{
	"g3-runtime":    "5a1ab8fdd71a8db76220de0d8867eea6c5a1fedd2889cfe9092f3e6f98d9f7b0",
	"layer1.tar":    "000cdf8c38857aab9b5a16244b98eb8f6017bf251f064c124622633c8850fc38",
	"layer2.tar":    "622d4366d78c36ca5ca6086e93b66d93305e0e11b95941375c1c4ff1f51cdfa1",
	"layer1.tar.gz": "e384c980a44e96f09d36cc4e6ffb44b4d7e03af6a75af1bd283c8cd9543aace7",
	"layer2.tar.gz": "af22bfbdda5d1f2c63684516b52acd617cd5913c758d117c044121992d67bb2d",
	"config.json":   "905dccbd2a9da110a68dcbfb17704b205eb10dfb326e51ace2a7db9bc5d3801e",
	"manifest.json": "82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
}

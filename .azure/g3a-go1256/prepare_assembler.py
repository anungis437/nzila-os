"""Prepare, never execute, next assembler source using the proven staged compressor."""

import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / "g3a-portable"


def main():
    result = json.loads((HERE / "COMPRESSOR_RESULT.json").read_text())
    if result["status"] != "PROVEN_EXACT_BOTH_LAYERS_DOUBLE_RUN":
        raise RuntimeError("BOTH_LAYER_EXACT_PREREQUISITE")
    prior_check = json.loads((PRIOR / "ASSEMBLER_LOCAL_CHECK_V3.json").read_text())
    source_path = PRIOR / "assembler" / "main.go"
    raw = source_path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != prior_check["sourceHashes"]["main.go"]:
        raise RuntimeError("SEALED_ASSEMBLER_SOURCE_CHANGED")
    text = raw.decode()
    start = text.index("\tvar compressed bytes.Buffer\n")
    end = text.index("\n}\n", start)
    old = text[start:end]
    if "gzip.NewWriter" not in old or old.count("return content.Bytes(), compressed.Bytes(), nil") != 1:
        raise RuntimeError("EXACT_COMPRESSION_SOURCE_ANCHOR")
    text = text[:start] + (
        "\tcompressed, err := compressStaged(content.Bytes(), compressor, work)\n"
        "\tif err != nil {\n\t\treturn nil, nil, err\n\t}\n"
        "\treturn content.Bytes(), compressed, nil"
    ) + text[end:]
    text = text.replace('\t"compress/gzip"\n', "", 1)
    signature = "func makeLayer(files []struct {"
    if text.count(signature) != 1:
        raise RuntimeError("ASSEMBLER_LAYER_SIGNATURE")
    signature_end = text.index("}) ([]byte, []byte, error) {", text.index(signature))
    text = text[:signature_end] + text[signature_end:].replace(
        "}) ([]byte, []byte, error) {", "}, compressor, work string) ([]byte, []byte, error) {", 1)
    text = text.replace('makeLayer([]file{{"g3-runtime", 0755, app, false}})',
                        'makeLayer([]file{{"g3-runtime", 0755, app, false}}, '
                        'filepath.Join(inputs, "compressor-go1256"), work)', 1)
    close = '\t\t{"etc/ssl/certs/ca-certificates.crt", 0644, payloads["ca-certificates.crt"], false},\n\t})'
    if text.count(close) != 1:
        raise RuntimeError("CERTIFICATE_LAYER_CALL_ANCHOR")
    text = text.replace(close, close[:-2] + '}, filepath.Join(inputs, "compressor-go1256"), work)', 1)
    destination = HERE / "prepared-assembler"
    destination.mkdir()
    for name, payload in (("main.go", text.encode()), ("go.mod", (PRIOR / "assembler" / "go.mod").read_bytes())):
        with (destination / name).open("xb") as file:
            file.write(payload)
    bindings = json.loads((PRIOR / "inputs" / "binding.json").read_text())
    binary = (HERE / "compressor-go1256").read_bytes()
    bindings["inputs"]["compressor-go1256"] = {
        "bytes": len(binary), "sha256": hashlib.sha256(binary).hexdigest(),
    }
    with (HERE / "PROPOSED_UPDATED_BUILD_BINDING.json").open("x", encoding="utf-8") as file:
        json.dump(bindings, file, indent=2)
        file.write("\n")
    print("UPDATED_ASSEMBLER_SOURCE_PREPARED_NOT_EXECUTED")


if __name__ == "__main__":
    main()

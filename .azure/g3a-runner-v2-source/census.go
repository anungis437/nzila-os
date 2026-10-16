package main

import (
	"archive/tar"
	"bytes"
	"errors"
	"io"
)

func embeddedCensus() ([]byte, error) {
	reader := tar.NewReader(bytes.NewReader(payload))
	for {
		header, err := reader.Next()
		if err != nil {
			return nil, err
		}
		if header.Name == "census.json" {
			if header.Size <= 0 || header.Size > 1024*1024 {
				return nil, errors.New("CENSUS_SIZE")
			}
			return io.ReadAll(io.LimitReader(reader, header.Size))
		}
	}
}

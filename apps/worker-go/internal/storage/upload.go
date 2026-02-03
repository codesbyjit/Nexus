package storage

import (
	"context"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func (c *Client) UploadFolder(dir, prefix string) error {
	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if info == nil || info.IsDir() {
			return nil
		}

		key := prefix + "/" + path[len(dir)+1:]
		file, _ := os.Open(path)
		defer file.Close()

		_, err = c.s3.PutObject(context.TODO(), &s3.PutObjectInput{
			Bucket: &c.bucket,
			Key:    &key,
			Body:   file,
		})
		return err
	})
}
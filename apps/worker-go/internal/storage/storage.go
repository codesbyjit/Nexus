package storage

import (
	"context"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Client struct {
	s3     *s3.Client
	bucket string
}

func NewFromEnv() (*Client, error) {
	cfg, err := config.LoadDefaultConfig(
		context.TODO(),
		config.WithRegion("us-east-1"),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				os.Getenv("S3_ACCESS_KEY"),
				os.Getenv("S3_SECRET_KEY"),
				"",
			),
		),
		config.WithEndpointResolver(
			aws.EndpointResolverFunc(func(service, region string) (aws.Endpoint, error) {
				return aws.Endpoint{
					URL:           os.Getenv("S3_ENDPOINT"),
					SigningRegion: region,
				}, nil
			}),
		),
	)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	return &Client{
		s3:     client,
		bucket: os.Getenv("S3_BUCKET"),
	}, nil
}

func (c *Client) Download(key, dst string) error {
	out, err := c.s3.GetObject(context.TODO(), &s3.GetObjectInput{
		Bucket: &c.bucket,
		Key:    &key,
	})
	if err != nil {
		return err
	}
	defer out.Body.Close()

	os.MkdirAll(filepath.Dir(dst), 0755)
	f, _ := os.Create(dst)
	defer f.Close()

	_, err = f.ReadFrom(out.Body)
	return err
}
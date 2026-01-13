FROM golang:1.25-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY . .

RUN go build -o worker ./cmd

CMD ["./worker"]
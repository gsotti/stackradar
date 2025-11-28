FROM alpine:latest

RUN apk add --no-cache curl bash

COPY log-generator.sh /log-generator.sh
RUN chmod +x /log-generator.sh

CMD ["/log-generator.sh"]

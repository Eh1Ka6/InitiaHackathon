FROM debian:12-slim

ARG MINIEVM_VERSION=v1.2.15
ARG ARCH=x86_64

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    ca-certificates curl jq tar bash python3 \
 && rm -rf /var/lib/apt/lists/*

RUN curl -sSL -o /tmp/minievm.tar.gz \
    "https://github.com/initia-labs/minievm/releases/download/${MINIEVM_VERSION}/minievm_${MINIEVM_VERSION}_Linux_${ARCH}.tar.gz" \
 && tar -xzf /tmp/minievm.tar.gz -C /tmp \
 && (cp /tmp/minitiad /usr/local/bin/minitiad 2>/dev/null || cp /tmp/minievm /usr/local/bin/minitiad) \
 && chmod +x /usr/local/bin/minitiad \
 && rm -rf /tmp/minievm.tar.gz /tmp/minitiad /tmp/minievm /tmp/LICENSE /tmp/README.md 2>/dev/null || true \
 && minitiad version

WORKDIR /root
COPY init-chain.sh /usr/local/bin/init-chain.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/init-chain.sh /usr/local/bin/entrypoint.sh

EXPOSE 8545 8546 26657 1317 9090

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

FROM mcr.microsoft.com/vscode/devcontainers/base:ubuntu-24.04
SHELL ["/bin/bash", "-c"]

ENV NVM_DIR=/root/.nvm
ENV NODE_VERSION=22.15.1

RUN apt update \
    && apt install -y bash-completion vim curl bash git tar gzip libc++-dev jq python3 build-essential

# Install nvm, node and npm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install ${NODE_VERSION} \
    && nvm use ${NODE_VERSION} \
    && nvm alias default ${NODE_VERSION}

# Add node and npm to path
ENV PATH="${NVM_DIR}/versions/node/v${NODE_VERSION}/bin:${PATH}"
RUN npm i -g yarn tsx

ENV PATH="root/.nargo/bin:$PATH"
ENV PATH="root/.bb:$PATH"

# Install noir
RUN curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash && \
    echo 'export PATH="root/.nargo/bin:$PATH"' >> root/.bashrc && \
    noirup -v 1.0.0-beta.7

# Install bb
RUN curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/master/barretenberg/bbup/install | bash && \
    echo 'export PATH="root/.bb:$PATH"' >> root/.bashrc && \
    bbup

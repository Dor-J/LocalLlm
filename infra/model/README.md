# Local Model Assets

This directory contains only model import metadata. Do not commit model weight
files here.

`*.gguf` is ignored by git because GGUF model files are large third-party
artifacts with their own licenses. Download them locally after cloning the
repo.

## Ollama Registry Models

The default Docker Compose stack pulls these models into the persistent
`ollama-data` Docker volume:

```powershell
docker compose --env-file infra/docker/compose.env -f infra/docker/docker-compose.yml up ollama ollama-model-qwen35-2b ollama-model-gemma4-e2b
```

Or pull them with a host Ollama install:

```powershell
ollama pull qwen3.5:2b
ollama pull gemma4:e2b
```

## Optional GGUF Import

The optional `gemma4-e2b-uncensored-q5_k_p` model is imported from a local GGUF
file and is not redistributed by this repo.

1. Review the upstream model card and license before downloading:
   `https://huggingface.co/HauhauCS/Gemma-4-E2B-Uncensored-HauhauCS-Aggressive`
2. Download this file into `infra/model/`:
   `Gemma-4-E2B-Uncensored-HauhauCS-Aggressive-Q5_K_P.gguf`

With `huggingface-cli`:

```powershell
huggingface-cli download HauhauCS/Gemma-4-E2B-Uncensored-HauhauCS-Aggressive Gemma-4-E2B-Uncensored-HauhauCS-Aggressive-Q5_K_P.gguf --local-dir infra/model
```

3. Enable the optional Compose profile:

```powershell
docker compose --profile uncensored --env-file infra/docker/compose.env -f infra/docker/docker-compose.yml up ollama ollama-model-gemma4-e2b-uncensored
```

The Dockerfile expects the exact filename above:

```text
infra/model/Gemma-4-E2B-Uncensored-HauhauCS-Aggressive-Q5_K_P.gguf
```

If you choose a different quantization, update
`Dockerfile.gemma4-e2b-uncensored` and `Modelfile.gemma4-e2b-uncensored`
locally.

## Notices

- `NOTICE.qwen3.5-2b.md`
- `NOTICE.gemma4-e2b.md`
- `NOTICE.gemma4-e2b-uncensored-q5_k_p.md`

These files document model attribution and licensing notes. They do not grant
additional model rights.

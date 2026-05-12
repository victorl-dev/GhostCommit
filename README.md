# GhostCommit

**Auto commits & GitHub Shadow Tracker**

Voce programa em projetos pessoais mas esquece de publicar no GitHub?
Isso faz seu perfil parecer vazio. O GhostCommit faz auto commits
automaticos (shadow commits) para mostrar que voce esta ativo,
mesmo em projetos que nunca sao publicados.

## Como funciona

1. Instala a extensao
2. Programa normalmente (ou usa AI agents)
3. GhostCommit detecta alteracoes em arquivos e faz shadow commits
4. Seu grafico de contribuicoes do GitHub fica verdinho

## Instalacao

### VS Code
- Extensions > Search GhostCommit > Install
- Ou baixe o .vsix e instale manualmente

### Antigravity / Cursor / VSCodium
- Baixe o .vsix e instale manualmente
- Extensions > ... > Install from VSIX

## Comandos

| Comando | Descricao |
|---------|-----------|
| GhostCommit: Start Tracking | Inicia monitoramento |
| GhostCommit: Stop Tracking | Pausa |
| GhostCommit: Open Dashboard | Painel com metricas ao vivo |
| GhostCommit: Daily Summary | Resumo do dia |
| GhostCommit: Set Gemini API Key | Configura chave da IA |
| GhostCommit: Setup Profile README | Configura README do perfil GitHub |
| GhostCommit: Add Project to Blacklist | Oculta projeto (commits continuam) |

## Configuracoes

| Chave | Padrao | Descricao |
|-------|--------|-----------|
| ghostcommit.autoStart | true | Inicia automaticamente |
| ghostcommit.changeThreshold | 10 | Arquivos unicos antes de commitar |
| ghostcommit.flushInterval | 30 | Minutos de inatividade |
| ghostcommit.commitMode | hybrid | hybrid / auto / generic |
| ghostcommit.autoPush | true | Push automatico do README |
| ghostcommit.template | artistic | artistic / cyber / retro |

## Templates SVG

- **Artistic** (hand-drawn)
- **Cyber-Minimalist** (clean modern)
- **Retro Terminal** (ASCII pixel style)

## Tech Stack

- TypeScript + Node.js
- VS Code Extension API
- Gemini API (opcional, para resumos)
- Octokit (GitHub API)

---

Projeto por Victor Lobato
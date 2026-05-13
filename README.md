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

![Contributions](https://res.cloudinary.com/dmii83n8i/image/upload/f_auto,q_auto/image22_wijilf)

> Atualização automática e silenciosa no seu perfil do GitHub — cada save vira um commit fantasma no mesmo dia.

![Metrics Preview](https://res.cloudinary.com/dmii83n8i/image/upload/f_auto,q_auto/2222_pjkqw5)

**📊 Dados exibidos no card:**

| Métrica | O que significa |
|---------|----------------|
| **Commits** | Quantas vezes você salvou um arquivo hoje |
| **Echoes** | Quantas vezes o fantasma apareceu — a cada N saves ele dá um "grito" no GitHub e seu gráfico fica verdinho |
| **Projetos** | Nomes dos projetos que você editou (projetos ocultos viram `[hidden]`) |
| **Linguagens** | As stacks que você mais usou no dia, com barra de progresso |
| **Último arquivo** | O último arquivo que você salvou |

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
| GhostCommit: Setup Profile README | Configura README do perfil GitHub |
| GhostCommit: Add Project to Blacklist | Oculta projeto (commits continuam) |

## Configuracoes

| Chave | Padrao | Descricao |
|-------|--------|-----------|
| ghostcommit.autoStart | true | Inicia automaticamente |
| ghostcommit.changeThreshold | 100 | Saves antes de commitar |
| ghostcommit.flushInterval | 120 | Minutos de inatividade |
| ghostcommit.commitMode | hybrid | hybrid / auto / generic |
| ghostcommit.autoPush | true | Push automatico do README |
| ghostcommit.template | ghost | ghost / wraith / shadow |

## Templates SVG

- **Ghost** (dark blue)
- **Wraith** (dark green)
- **Shadow** (dark purple)

## Tech Stack

- TypeScript + Node.js
- VS Code Extension API
- Octokit (GitHub API)

---

Projeto por Victor Lobato
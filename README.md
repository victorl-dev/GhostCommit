# GhostCommit

**Auto commits & GitHub Shadow Tracker**

[English Version](#-english-version) | [Versão em Português](#-versão-em-português)

---

### 🇺🇸 English Version

Do you code on personal projects but forget to publish them to GitHub? This makes your profile look empty. **GhostCommit** makes automatic shadow commits to show you're active, even in projects that are never published.

#### 🚀 How it works
1. Install the extension.
2. Code normally (or use AI agents).
3. GhostCommit detects file changes and creates shadow commits.
4. Your GitHub contribution graph stays green.

![Contributions](https://res.cloudinary.com/dmii83n8i/image/upload/f_auto,q_auto/image22_wijilf)

> Automatic and silent updates to your GitHub profile — every save becomes a ghost commit on the same day.

![Metrics Preview](https://res.cloudinary.com/dmii83n8i/image/upload/f_auto,q_auto/2222_pjkqw5)

**📊 Card Metrics:**

| Metric | Description |
| :--- | :--- |
| **Commits** | Times you saved a file today |
| **Echoes** | Ghost appearances — every N saves it pings GitHub and your graph stays green |
| **Projects** | Names of edited projects (hidden projects show as `[hidden]`) |
| **Languages** | Most used stacks with progress bar |
| **Last file** | Last file you saved |

#### 📦 Installation

**VS Code**
- Extensions > Search **GhostCommit** > Install
- Or download the `.vsix` and install manually.

**Antigravity / Cursor / VSCodium**
- Download the `.vsix` and install manually.
- Extensions > `...` > Install from VSIX.

#### ⌨️ Commands

| Command | Description |
| :--- | :--- |
| GhostCommit: Start Tracking | Starts monitoring |
| GhostCommit: Stop Tracking | Pauses monitoring |
| GhostCommit: Open Dashboard | Live metrics panel |
| GhostCommit: Daily Summary | Today's summary |
| GhostCommit: Setup Profile README | Configures GitHub Profile README |
| GhostCommit: Add Project to Blacklist | Hides project (commits continue) |

#### ⚙️ Settings

| Key | Default | Description |
| :--- | :--- | :--- |
| `ghostcommit.autoStart` | `true` | Starts automatically |
| `ghostcommit.changeThreshold` | `100` | Saves before committing |
| `ghostcommit.flushInterval` | `120` | Inactivity minutes |
| `ghostcommit.commitMode` | `hybrid` | `hybrid` / `auto` / `generic` |
| `ghostcommit.autoPush` | `true` | README auto-push |
| `ghostcommit.template` | `ghost` | `ghost` / `wraith` / `shadow` |

#### 🎨 SVG Templates
- **Ghost** (dark blue)
- **Wraith** (dark green)
- **Shadow** (dark purple)

#### 🛠️ Tech Stack
- TypeScript + Node.js
- VS Code Extension API
- Octokit (GitHub API)

---

### 🇧🇷 Versão em Português

Você programa em projetos pessoais mas esquece de publicar no GitHub? Isso faz seu perfil parecer vazio. O **GhostCommit** faz auto commits automáticos (shadow commits) para mostrar que você está ativo, mesmo em projetos que nunca são publicados.

#### 🚀 Como funciona
1. Instala a extensão.
2. Programa normalmente (ou usa agentes de IA).
3. GhostCommit detecta alterações em arquivos e faz shadow commits.
4. Seu gráfico de contribuições do GitHub fica verdinho.

![Contributions](https://res.cloudinary.com/dmii83n8i/image/upload/f_auto,q_auto/image22_wijilf)

> Atualização automática e silenciosa no seu perfil do GitHub — cada save vira um commit fantasma no mesmo dia.

![Metrics Preview](https://res.cloudinary.com/dmii83n8i/image/upload/f_auto,q_auto/2222_pjkqw5)

**📊 Dados exibidos no card:**

| Métrica | O que significa |
| :--- | :--- |
| **Commits** | Quantas vezes você salvou um arquivo hoje |
| **Echoes** | Quantas vezes o fantasma apareceu — a cada N saves ele dá um "grito" no GitHub e seu gráfico fica verdinho |
| **Projetos** | Nomes dos projetos que você editou (projetos ocultos viram `[hidden]`) |
| **Linguagens** | As stacks que você mais usou no dia, com barra de progresso |
| **Último arquivo** | O último arquivo que você salvou |

#### 📦 Instalação

**VS Code**
- Extensions > Search **GhostCommit** > Install
- Ou baixe o `.vsix` e instale manualmente.

**Antigravity / Cursor / VSCodium**
- Baixe o `.vsix` e instale manualmente.
- Extensions > `...` > Install from VSIX.

#### ⌨️ Comandos

| Comando | Descrição |
| :--- | :--- |
| GhostCommit: Start Tracking | Inicia monitoramento |
| GhostCommit: Stop Tracking | Pausa |
| GhostCommit: Open Dashboard | Painel com métricas ao vivo |
| GhostCommit: Daily Summary | Resumo do dia |
| GhostCommit: Setup Profile README | Configura README do perfil GitHub |
| GhostCommit: Add Project to Blacklist | Oculta projeto (commits continuam) |

#### ⚙️ Configurações

| Chave | Padrão | Descrição |
| :--- | :--- | :--- |
| `ghostcommit.autoStart` | `true` | Inicia automaticamente |
| `ghostcommit.changeThreshold` | `100` | Saves antes de commitar |
| `ghostcommit.flushInterval` | `120` | Minutos de inatividade |
| `ghostcommit.commitMode` | `hybrid` | `hybrid` / `auto` / `generic` |
| `ghostcommit.autoPush` | `true` | Push automático do README |
| `ghostcommit.template` | `ghost` | `ghost` / `wraith` / `shadow` |

#### 🎨 Templates SVG
- **Ghost** (dark blue)
- **Wraith** (dark green)
- **Shadow** (dark purple)

#### 🛠️ Tech Stack
- TypeScript + Node.js
- VS Code Extension API
- Octokit (GitHub API)

---

**Desenvolvido por Victor Lobato de Oliveira**.
*Estudante de ADS e Desenvolvedor de Software*.

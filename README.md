<!--
SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
-->

# Element Admin

Element Admin is a web-based administration panel for the [Element Server Suite](https://element.io/server-suite), available in both [ESS Pro](https://element.io/server-suite/pro) and in the free [ESS Community](https://github.com/element-hq/ess-helm) edition.

## 🚀 Try it

You can try the latest Element Admin using the hosted version at <https://admin-beta.element.dev/>.

![Dashboard screenshot](./docs/screenshot.png)

## 🚀 Getting started

This component is developed and maintained by [Element](https://element.io). It gets shipped as part of the **Element Server Suite (ESS)** which provides the official means of deployment.

ESS is a Matrix distribution from Element with focus on quality and ease of use. It ships a full Matrix stack tailored to the respective use case.

There are three editions of ESS:

- [ESS Community](https://github.com/element-hq/ess-helm) - the free Matrix distribution from Element tailored to small-/mid-scale, non-commercial community use cases
- [ESS Pro](https://element.io/server-suite/pro) - the commercial Matrix distribution from Element for professional use
- [ESS TI-M](https://element.io/server-suite/ti-messenger) - a special version of ESS Pro focused on the requirements of TI-Messenger Pro and ePA as specified by the German National Digital Health Agency Gematik

## 💬 Community room

Developers and users of Element Admin can chat in the [#ess-community:element.io](https://matrix.to/#/#ess-community:element.io) room on Matrix.

## 📝 Prerequisites and standalone installation

Element Admin is designed to work with the components that ship with [ESS](https://element.io/en/server-suite).
It assumes the following, which is **handled out of the box by ESS version 25.9.2 or later**:

- A [Synapse](https://github.com/element-hq/synapse) instance and [its admin API](https://element-hq.github.io/synapse/latest/reverse_proxy.html#synapse-administration-endpoints) accessible
- A [Matrix Authentication Service](https://github.com/element-hq/matrix-authentication-service) instance with [its admin API](https://element-hq.github.io/matrix-authentication-service/topics/admin-api.html#enabling-the-api) accessible
- An domain name with a valid SSL certificate (HTTPS) where to host Element Admin. It _must_ be served from a secure context, as required by the next-generation auth Matrix APIs.

Under the hood, Element Admin is a single-page application React application which can be deployed in any static hosting service or container environment.

<details>
<summary><b>🐳 Using Docker</b></summary>

A pre-built Docker image is available on Element's container registry:

```bash
docker run -p 8080:8080 oci.element.io/element-admin:latest
```

It can be configured using the following environment variables:

| Variable      | Description                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `SERVER_NAME` | The name of the Matrix server to use. If not set, the user will be prompted to enter a server name. |

A local Docker image can be built from the source code using the following command:

```bash
docker build -t element-admin .
```

</details>
<details>
<summary><b>📦 Building from the source code</b></summary>

1. Clone the repository:

```bash
git clone https://github.com/element-hq/element-admin.git
cd element-admin
```

2. Install dependencies (requires Node.js 18+ and pnpm):

```bash
pnpm install
```

3. Build the application

```bash
pnpm build
```

The built application will be in the `dist/` directory, ready to be deployed to any static hosting service.

</details>

## 🌍 Translations

Element Admin is available in multiple languages.
Anyone can contribute to translations through [Localazy](https://localazy.com/p/element-admin).

## 🏗️ Contributing

We welcome contributions from the community! If you'd like to suggest changes or contribute to the project, please come and chat with us first in the [#ess-community:element.io](https://matrix.to/#/#ess-community:element.io) room on Matrix.

### Development workflow

- **Linting & Formatting:** Run `pnpm lint` to check code style and `pnpm fix` to auto-fix issues
- **Translation extraction:** Run `pnpm i18n:extract` when adding or changing translatable strings, and commit the regenerated English files under `translations/`. The other languages are translated on [Localazy](https://localazy.com/p/element-admin): the extracted messages are uploaded there on every push to `main`, and the translations come back through the download workflow's automated pull requests

## ⚖️ Copyright & License

Copyright 2025 New Vector Ltd.
Copyright 2025, 2026 Element Creations Ltd.

This software is dual-licensed by Element Creations Ltd. It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, version 3 of the License); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).

Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.

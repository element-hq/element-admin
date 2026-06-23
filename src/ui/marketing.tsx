// Copyright 2025, 2026 Element Creations Ltd.
// Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import {
  AdminIcon,
  ExportArchiveIcon,
  LeaveIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button } from "@vector-im/compound-web";
import { FormattedMessage } from "react-intl";

import * as Card from "@/components/card";
import { ProBadge } from "@/components/logo";

export const AlsoAvailableInPro = () => (
  <Card.Root kind="primary" narrow>
    <Card.Header>
      <Card.Title>
        <FormattedMessage
          id="marketing.also_available_in_pro.title"
          defaultMessage="Also available in Pro…"
          description="When we show off a feature that is only available in ESS Pro, this is the title of the card explaining what ESS Pro is"
        />
      </Card.Title>
      <ProBadge />
    </Card.Header>

    <Card.Body>
      <FormattedMessage
        id="marketing.also_available_in_pro.description"
        defaultMessage="<p><link>ESS Pro</link> is the commercial backend distribution from Element.</p>
<p>It includes everything in ESS Community plus additional features and
services that are tailored to professional environments with more than 100 users
up to massive scale in the millions.</p>
<p>It is designed to support enterprise requirements in terms of advanced IAM,
compliance, scalability, high availability and multi-tenancy.</p>"
        description="When we show off a feature that is only available in ESS Pro, this is the description of the card explaining what ESS Pro is"
        values={{
          // oxlint-disable react/no-unstable-nested-components
          p: (chunks) => <p>{...chunks}</p>,
          link: (chunks) => (
            // oxlint-disable-next-line jsx-a11y/control-has-associated-label
            <a
              target="_blank"
              href="https://element.io/pro"
              rel="noreferrer noopener"
            >
              {...chunks}
            </a>
          ),
          // oxlint-enable react/no-unstable-nested-components
        }}
      />
    </Card.Body>

    <Card.Footer>
      <Button
        as="a"
        target="_blank"
        href="https://try.element.io/upgrade-ess-community"
        kind="primary"
        size="md"
      >
        <FormattedMessage
          id="marketing.also_available_in_pro.upgrade"
          defaultMessage="Upgrade to Pro"
          description="When we show off a feature that is only available in ESS Pro, this is the button to lead the user to the ESS Pro upgrade page"
        />
      </Button>
    </Card.Footer>
  </Card.Root>
);

export const SupervisionCard = ({ proBadge }: { proBadge?: boolean }) => (
  <Card.Root kind="secondary">
    <Card.Header>
      <Card.Icon icon={AdminIcon} />
      <Card.Title>
        <FormattedMessage
          id="marketing.supervision.title"
          defaultMessage="Supervision"
          description="Title of the card explaining what supervision is"
        />
      </Card.Title>
      {proBadge && <ProBadge />}
    </Card.Header>

    <FormattedMessage
      id="marketing.supervision.description"
      defaultMessage="<p>Supervision enables an organisation to administer all rooms from a central
point. A 'supervisor' account will join defined rooms with room admin privileges.
Server administrators can seamlessly impersonate the account from the admin
console to manage and supervise their rooms.</p>
<ul><li>Manage rooms and their settings (name, topic, permissions, etc.)</li>
<li>Manage room memberships</li>
<li>Remove unwanted messages and uploaded media</li>
<li>Recover abandoned rooms (all users have left)</li>
<li>Supervisor account can or cannot read encrypted message contents (configurable)</li></ul>"
      values={{
        // oxlint-disable react/no-unstable-nested-components
        p: (chunks) => <Card.Body>{...chunks}</Card.Body>,
        ul: (chunks) => <Card.Checklist>{...chunks}</Card.Checklist>,
        li: (chunks) => <Card.ChecklistItem>{...chunks}</Card.ChecklistItem>,
        // oxlint-enable react/no-unstable-nested-components
      }}
      description="Description of the card explaining what supervision is"
    />
  </Card.Root>
);

export const SBGCard = ({ proBadge }: { proBadge?: boolean }) => (
  <Card.Root kind="secondary">
    <Card.Header>
      <Card.Icon icon={LeaveIcon} />
      <Card.Title>
        <FormattedMessage
          id="marketing.sbg.title"
          defaultMessage="Secure Border Gateway"
          description="Title of the card explaining what the Secure Border Gateway is"
        />
      </Card.Title>
      {proBadge && <ProBadge />}
    </Card.Header>

    <FormattedMessage
      id="marketing.sbg.description"
      defaultMessage="<p>Secure Border Gateway is an application-level firewall for Matrix servers.</p>
<ul><li>Inspects all requests to and from the server</li>
<li>Can use all request metadata to enforce rules</li>
<li>Pipeline-based approach to connect APIs and rule sets</li>
<li>Pluggable rules engine that can be applied to the pipelines</li></ul>"
      values={{
        // oxlint-disable react/no-unstable-nested-components
        p: (chunks) => <Card.Body>{...chunks}</Card.Body>,
        ul: (chunks) => <Card.Checklist>{...chunks}</Card.Checklist>,
        li: (chunks) => <Card.ChecklistItem>{...chunks}</Card.ChecklistItem>,
        // oxlint-enable react/no-unstable-nested-components
      }}
      description="Description of the card explaining what the Secure Border Gateway is"
    />
  </Card.Root>
);

export const AuditingCard = ({ proBadge }: { proBadge?: boolean }) => (
  <Card.Root kind="secondary">
    <Card.Header>
      <Card.Icon icon={ExportArchiveIcon} />
      <Card.Title>
        <FormattedMessage
          id="marketing.auditing.title"
          defaultMessage="Auditing"
          description="Title of the card explaining what auditing is"
        />
      </Card.Title>
      {proBadge && <ProBadge />}
    </Card.Header>

    <Card.Body>
      <FormattedMessage
        id="marketing.auditing.description"
        defaultMessage="<p>Auditing gives organizations the ability to keep records of end-to-end
encrypted conversations and room events to meet compliance or legal
requirements.</p>
<p>When enabled, it is visible to all end users which rooms are being recorded
to ensure transparency of the auditing process.</p>
<p>Auditing can be configured to suit an organization’s specific requirements.
For instance direct messages between two individuals can be excluded so that
only group conversations are recorded.</p>
<p>Audit data is being stored as a stream of machine-readable events in the JSON
format either on file storage or S3 and can be forwarded to log analyzer tooling
for further filtering and analysis.</p>"
        values={{
          // oxlint-disable-next-line react/no-unstable-nested-components
          p: (chunks) => <p>{...chunks}</p>,
        }}
        description="Description of the card explaining what auditing is"
      />
    </Card.Body>
  </Card.Root>
);

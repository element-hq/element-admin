// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { Page } from "@playwright/test";

import type {
  SendServerNoticeParameters,
  ServerEventParameters,
} from "@/api/synapse";

import { http, HttpResponse } from "msw";

import { heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import { observeQuery } from "../mocks/mas";
import { matrixFailing } from "../mocks/failing";
import {
  DEFAULT_ANNOUNCEMENT_ROOMS,
  DEFAULT_ROOMS,
  DEFAULT_USERS,
  roomId,
  SERVER_NAME,
  userId,
} from "../mocks/fixtures";
import {
  matrixError,
  sendServerAnnouncement,
  sendServerNotice,
  sendServerNoticeDisabled,
  serverAnnouncements,
  serverNoticesProbe,
} from "../mocks/matrix";
import { expect, test } from "../mocks/test";

const TITLE = "Send an announcement";
const ALICE = `@alice:${SERVER_NAME}`;

const userCard = (page: Page) =>
  page.getByRole("radio", { name: "A specific user" });
const roomCard = (page: Page) =>
  page.getByRole("radio", { name: "An announcement room" });
const roomSearch = (page: Page) =>
  page.getByRole("combobox", { name: "Announcement room" });
const toast = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

test.describe("send an announcement", () => {
  test("renders the form with the user card selected", async ({ page }) => {
    await loginAs(page);
    await page.goto("/announcements");

    await expect(page.getByRole("heading", heading(TITLE))).toBeVisible();
    await expect(userCard(page)).toBeChecked();
    // The room card is enabled once the configured rooms loaded.
    await expect(roomCard(page)).toBeEnabled();
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  test("is linked from the dashboard", async ({ page }) => {
    await loginAs(page);
    await page.goto("/");

    await page.getByRole("link", { name: "Send an announcement" }).click();

    await expect(page.getByRole("heading", heading(TITLE))).toBeVisible();
  });

  test("preselects the user from a deep link", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/announcements?user=${encodeURIComponent(ALICE)}`);

    await expect(userCard(page)).toBeChecked();
    await expect(page.getByText(ALICE, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      `/users/${userId(DEFAULT_USERS, 1)}`,
    );
    // A recipient alone is not enough: the message is required too.
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
    await page.getByRole("textbox", { name: "Message" }).fill("Hi");
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  test("reports a deep-linked user which is not on this server", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto(
      `/announcements?user=${encodeURIComponent("@carol:example.org")}`,
    );

    await expect(
      page.getByText("@carol:example.org is not a user of this server"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  test("preselects the room from a deep link", async ({ page }) => {
    await loginAs(page);
    await page.goto("/announcements?room=general");

    await expect(roomCard(page)).toBeChecked();
    await expect(page.getByText("Server announcements")).toBeVisible();
    await expect(page.getByText("general", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      `/rooms/${encodeURIComponent(roomId(DEFAULT_ROOMS, 0))}`,
    );
  });

  test("lists a deleted announcement room as unavailable", async ({ page }) => {
    await loginAs(page);
    await page.goto("/announcements?room=ops");

    await expect(page.getByText("Maintenance (deleted)")).toBeVisible();
    await expect(
      page.getByText("This room was deleted. Restart Synapse to recreate it."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();

    // Cleared, the room is still listed but cannot be picked again.
    await page.getByRole("button", { name: "Clear selection" }).click();
    await roomSearch(page).fill("maint");
    const option = page.getByRole("option", {
      name: /Maintenance \(deleted\)/,
    });
    await expect(option).toHaveAttribute("aria-disabled", "true");
    await roomSearch(page).press("ArrowDown");
    await roomSearch(page).press("Enter");
    await expect(roomSearch(page)).toBeVisible();
  });

  test("reports a deep-linked room which is not configured", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto("/announcements?room=nope");

    await expect(
      page.getByText(
        "The announcement room “nope” is not configured on this server.",
      ),
    ).toBeVisible();
    await expect(roomCard(page)).toBeChecked();
    await expect(roomSearch(page)).toHaveValue("");
  });

  test("sends Markdown to an announcement room", async ({ page, network }) => {
    const sent: [string, ServerEventParameters][] = [];
    network.use(
      sendServerAnnouncement(DEFAULT_ANNOUNCEMENT_ROOMS, (id, body) =>
        sent.push([id, body]),
      ),
    );

    await loginAs(page);
    await page.goto("/announcements");

    await roomCard(page).check();
    await roomSearch(page).fill("server");
    await page.getByRole("option", { name: /Server announcements/ }).click();

    const message = page.getByRole("textbox", { name: "Message" });
    await message.fill("Hello **everyone**");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(toast(page, "Announcement sent")).toBeVisible();
    await expect(message).toHaveValue("");

    await message.fill("Just plain text");
    await page.getByRole("button", { name: "Send" }).click();
    await expect.poll(() => sent.length).toBe(2);

    expect(sent).toEqual([
      [
        "general",
        {
          content: {
            msgtype: "m.text",
            body: "Hello **everyone**",
            format: "org.matrix.custom.html",
            formatted_body: "Hello <strong>everyone</strong>",
          },
        },
      ],
      ["general", { content: { msgtype: "m.text", body: "Just plain text" } }],
    ]);

    // The chosen room stays selected, with a link to it.
    await page.getByRole("link", { name: "View" }).click();
    await expect(
      page.getByRole("heading", { name: "General", level: 3 }),
    ).toBeVisible();
  });

  test("sends a server notice to a user", async ({ page, network }) => {
    const sent: SendServerNoticeParameters[] = [];
    network.use(sendServerNotice((body) => sent.push(body)));

    await loginAs(page);
    await page.goto(`/announcements?user=${encodeURIComponent(ALICE)}`);
    await expect(page.getByText(ALICE, { exact: true })).toBeVisible();

    await page.getByRole("textbox", { name: "Message" }).fill("Hi Alice");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(toast(page, "Server notice sent")).toBeVisible();
    expect(sent).toEqual([
      { user_id: ALICE, content: { msgtype: "m.text", body: "Hi Alice" } },
    ]);
  });

  test("picks a user and sends a raw event", async ({ page, network }) => {
    const sent: SendServerNoticeParameters[] = [];
    network.use(sendServerNotice((body) => sent.push(body)));

    await loginAs(page);
    await page.goto("/announcements");

    await page.getByRole("combobox").fill("alice");
    await page.getByRole("option").first().click();

    await page.getByRole("radio", { name: "Raw event" }).check();
    await page
      .getByRole("textbox", { name: "Content (JSON)" })
      .fill('{"msgtype": "m.notice", "body": "Raw"}');
    await page.getByRole("button", { name: "Send" }).click();

    await expect(toast(page, "Server notice sent")).toBeVisible();
    expect(sent).toEqual([
      {
        user_id: ALICE,
        type: "m.room.message",
        content: { msgtype: "m.notice", body: "Raw" },
      },
    ]);
  });

  test("keeps the chosen user in the URL without adding history", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto("/announcements");
    const historyLength = await page.evaluate(() => history.length);

    await page.getByRole("textbox", { name: "Message" }).fill("Draft");
    await page.getByRole("combobox", { name: "User" }).fill("alice");
    await page.getByRole("option").first().click();

    await expect(page).toHaveURL(
      new RegExp(`user=${encodeURIComponent(ALICE)}`),
    );
    await expect(page.getByText(ALICE, { exact: true })).toBeVisible();

    // Picking another user keeps the message.
    await page.getByRole("button", { name: "Clear selection" }).click();
    await expect(page).not.toHaveURL(/user=/);
    await page.getByRole("combobox", { name: "User" }).fill("admin");
    await page.getByRole("option").first().click();
    await expect(page).toHaveURL(/user=%40admin%3Aexample\.com/);
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Draft",
    );

    expect(await page.evaluate(() => history.length)).toBe(historyLength);
  });

  test("resolves a picked user without looking it up again", async ({
    page,
    network,
  }) => {
    const lookups: URLSearchParams[] = [];
    network.use(
      observeQuery("/api/admin/v1/users/by-username/:username", (parameters) =>
        lookups.push(parameters),
      ),
    );

    await loginAs(page);
    await page.goto("/announcements");

    await page.getByRole("combobox", { name: "User" }).fill("alice");
    await page.getByRole("option").first().click();
    await expect(page).toHaveURL(/user=/);
    await expect(page.getByText(ALICE, { exact: true })).toBeVisible();

    expect(lookups).toEqual([]);
  });

  test("keeps the chosen room in the URL", async ({ page }) => {
    await loginAs(page);
    await page.goto("/announcements");
    const historyLength = await page.evaluate(() => history.length);

    await roomCard(page).check();
    await roomSearch(page).fill("general");
    await page.getByRole("option", { name: /Server announcements/ }).click();
    await expect(page).toHaveURL(/room=general/);

    await page.getByRole("button", { name: "Clear selection" }).click();
    await expect(page).not.toHaveURL(/room=/);
    await expect(roomCard(page)).toBeChecked();

    await roomSearch(page).fill("general");
    await page.getByRole("option", { name: /Server announcements/ }).click();
    await expect(page).toHaveURL(/room=general/);

    // Switching card drops the room.
    await userCard(page).check();
    await expect(page).not.toHaveURL(/room=/);
    await expect(userCard(page)).toBeChecked();

    expect(await page.evaluate(() => history.length)).toBe(historyLength);
  });

  test("follows a URL change while the page is open", async ({ page }) => {
    await loginAs(page);
    await page.goto("/announcements?room=general");
    await expect(page.getByText("general", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Message" }).fill("Draft");

    const visit = (url: string) =>
      page.evaluate((target) => {
        history.pushState(null, "", target);
        dispatchEvent(new PopStateEvent("popstate"));
      }, url);

    await visit(`/announcements?user=${encodeURIComponent(ALICE)}`);
    await expect(userCard(page)).toBeChecked();
    await expect(page.getByText(ALICE, { exact: true })).toBeVisible();

    await visit("/announcements?room=nope");
    await expect(
      page.getByText(
        "The announcement room \u201Cnope\u201D is not configured on this server.",
      ),
    ).toBeVisible();

    await visit("/announcements?room=ops");
    await expect(
      page.getByText("This room was deleted. Restart Synapse to recreate it."),
    ).toBeVisible();

    await visit(
      `/announcements?user=${encodeURIComponent("@carol:example.org")}`,
    );
    await expect(
      page.getByText("@carol:example.org is not a user of this server"),
    ).toBeVisible();

    await visit(
      `/announcements?user=${encodeURIComponent(`@nobody:${SERVER_NAME}`)}`,
    );
    await expect(
      page.getByText(`@nobody:${SERVER_NAME} is not a user of this server`),
    ).toBeVisible();

    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Draft",
    );
  });

  test("rejects raw content which is not a JSON object", async ({
    page,
    network,
  }) => {
    const sent: SendServerNoticeParameters[] = [];
    network.use(sendServerNotice((body) => sent.push(body)));

    await loginAs(page);
    await page.goto(`/announcements?user=${encodeURIComponent(ALICE)}`);
    await expect(page.getByText(ALICE, { exact: true })).toBeVisible();

    await page.getByRole("radio", { name: "Raw event" }).check();
    const content = page.getByRole("textbox", { name: "Content (JSON)" });

    await content.fill("not json");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Content must be a JSON object")).toBeVisible();

    await content.fill("[1, 2]");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Content must be a JSON object")).toBeVisible();

    expect(sent).toEqual([]);
  });

  test("rejects a membership event", async ({ page, network }) => {
    const sent: SendServerNoticeParameters[] = [];
    network.use(sendServerNotice((body) => sent.push(body)));

    await loginAs(page);
    await page.goto(`/announcements?user=${encodeURIComponent(ALICE)}`);
    await expect(page.getByText(ALICE, { exact: true })).toBeVisible();

    await page.getByRole("radio", { name: "Raw event" }).check();
    await page
      .getByRole("textbox", { name: "Event type" })
      .fill("m.room.member");
    await page
      .getByRole("textbox", { name: "Content (JSON)" })
      .fill('{"membership": "join"}');
    await page.getByRole("button", { name: "Send" }).click();

    await expect(
      page.getByText("Membership events cannot be sent."),
    ).toBeVisible();
    expect(sent).toEqual([]);
  });

  test("sends a raw event to a room", async ({ page, network }) => {
    const sent: [string, ServerEventParameters][] = [];
    network.use(
      sendServerAnnouncement(DEFAULT_ANNOUNCEMENT_ROOMS, (id, body) =>
        sent.push([id, body]),
      ),
    );

    await loginAs(page);
    await page.goto("/announcements?room=general");
    await expect(page.getByText("general", { exact: true })).toBeVisible();

    await page.getByRole("radio", { name: "Raw event" }).check();
    await page.getByRole("textbox", { name: "Event type" }).fill("m.custom");
    await page
      .getByRole("textbox", { name: "Content (JSON)" })
      .fill('{"key": "value"}');
    await page.getByRole("button", { name: "Send" }).click();

    await expect(toast(page, "Announcement sent")).toBeVisible();
    expect(sent).toEqual([
      ["general", { type: "m.custom", content: { key: "value" } }],
    ]);
  });

  test("keeps the content and recipient across a mode switch", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto(`/announcements?user=${encodeURIComponent(ALICE)}`);
    await expect(page.getByText(ALICE, { exact: true })).toBeVisible();

    await page.getByRole("textbox", { name: "Message" }).fill("Draft");
    await page.getByRole("radio", { name: "Raw event" }).check();
    await page.getByRole("textbox", { name: "Event type" }).fill("m.custom");
    await page.getByRole("radio", { name: "Message" }).check();

    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Draft",
    );
    await expect(page.getByText(ALICE, { exact: true })).toBeVisible();

    await page.getByRole("radio", { name: "Raw event" }).check();
    await expect(page.getByRole("textbox", { name: "Event type" })).toHaveValue(
      "m.custom",
    );
  });

  test("reports a deep-linked user unknown to the server", async ({ page }) => {
    await loginAs(page);
    await page.goto(
      `/announcements?user=${encodeURIComponent(`@nobody:${SERVER_NAME}`)}`,
    );

    await expect(
      page.getByText(`@nobody:${SERVER_NAME} is not a user of this server`),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "User" })).toHaveValue("");
  });

  test("shows a failed send to a room", async ({ page, network }) => {
    network.use(
      http.post("*/_synapse/admin/v1/server_announcements/:id/send", () =>
        HttpResponse.json(
          matrixError("M_FORBIDDEN", "The management user left the room"),
          { status: 403 },
        ),
      ),
    );

    await loginAs(page);
    await page.goto("/announcements?room=general");
    await expect(page.getByText("general", { exact: true })).toBeVisible();

    await page.getByRole("textbox", { name: "Message" }).fill("Hello");
    await page.getByRole("button", { name: "Send" }).click();

    const alert = page.getByRole("main").getByRole("status");
    await expect(alert).toContainText("Failed to send the announcement");
    await expect(alert).toContainText("The management user left the room");
    await expect(alert).not.toContainText("server_notices");
  });

  test("disables the room card when no room is configured", async ({
    page,
    network,
  }) => {
    network.use(serverAnnouncements([]));

    await loginAs(page);
    await page.goto("/announcements");

    await expect(
      page.getByText(
        "No announcement room is configured on this server. Add rooms under server_announcements in the Synapse configuration.",
      ),
    ).toBeVisible();
    await expect(roomCard(page)).toBeDisabled();
    await expect(userCard(page)).toBeChecked();
  });

  test("disables the user card when server notices are off", async ({
    page,
    network,
  }) => {
    network.use(serverNoticesProbe(false));

    await loginAs(page);
    await page.goto("/announcements");

    await expect(
      page.getByText(
        "Server notices are not enabled on this server. Enable them under server_notices in the Synapse configuration.",
      ),
    ).toBeVisible();
    await expect(userCard(page)).toBeDisabled();
    await expect(roomCard(page)).toBeChecked();
    await expect(roomSearch(page)).toBeVisible();
  });

  test("keeps a deep-linked user when server notices are off", async ({
    page,
    network,
  }) => {
    network.use(serverNoticesProbe(false));

    await loginAs(page);
    await page.goto(`/announcements?user=${encodeURIComponent(ALICE)}`);

    await expect(
      page.getByText("Server notices are not enabled on this server."),
    ).toBeVisible();
    await expect(userCard(page)).toBeDisabled();
    await expect(roomCard(page)).toBeChecked();
    await expect(page).toHaveURL(/user=/);
  });

  test("disables both cards when nothing can be sent", async ({
    page,
    network,
  }) => {
    network.use(serverNoticesProbe(false), serverAnnouncements([]));

    await loginAs(page);
    await page.goto("/announcements");

    await expect(userCard(page)).toBeDisabled();
    await expect(roomCard(page)).toBeDisabled();
    await expect(userCard(page)).not.toBeChecked();
    await expect(roomCard(page)).not.toBeChecked();
    await page.getByRole("textbox", { name: "Message" }).fill("Hi");
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  test("disables the room card on a Synapse without the API", async ({
    page,
    network,
  }) => {
    network.use(
      matrixFailing("/_synapse/admin/v1/server_announcements", 404, {
        errcode: "M_UNRECOGNIZED",
        error: "Unrecognized request",
      }),
    );

    await loginAs(page);
    await page.goto("/announcements?room=general");

    await expect(
      page.getByText(
        "This version of Synapse does not support announcement rooms.",
      ),
    ).toBeVisible();
    await expect(roomCard(page)).toBeDisabled();
    await expect(userCard(page)).toBeChecked();
  });

  test("explains a failure when server notices are disabled", async ({
    page,
    network,
  }) => {
    network.use(sendServerNoticeDisabled());

    await loginAs(page);
    await page.goto(`/announcements?user=${encodeURIComponent(ALICE)}`);
    await expect(page.getByText(ALICE, { exact: true })).toBeVisible();

    await page.getByRole("textbox", { name: "Message" }).fill("Hi Alice");
    await page.getByRole("button", { name: "Send" }).click();

    const alert = page.getByRole("main").getByRole("status");
    await expect(alert).toContainText("Failed to send the server notice");
    await expect(alert).toContainText(
      "Server notices are not enabled on this server",
    );
    await expect(alert).toContainText(
      "Enable them under server_notices in the Synapse configuration.",
    );

    // Editing the message makes the failure stale.
    await page.getByRole("textbox", { name: "Message" }).fill("Hi again");
    await expect(
      page.getByText("Failed to send the server notice"),
    ).toBeHidden();
  });
});

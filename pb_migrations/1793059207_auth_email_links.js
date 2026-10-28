/// <reference path="../pb_data/types.d.ts" />

// Points PocketBase auth emails at the Next.js app instead of the PocketBase admin UI.
// {APP_URL} is the storefront URL (set from PB_APP_URL by pb_hooks/app-url.pb.js).
// The path has no locale: the proxy redirects to the visitor's language.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    users.resetPasswordTemplate.subject = "Reset your {APP_NAME} password";
    users.resetPasswordTemplate.body = [
      "<p>Hello,</p>",
      "<p>Click the button below to choose a new password.</p>",
      '<p><a class="btn" href="{APP_URL}/auth/new-password?token={TOKEN}" target="_blank" rel="noopener">Reset password</a></p>',
      "<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>",
      "<p>{APP_NAME}</p>",
    ].join("\n");

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.resetPasswordTemplate.subject = "Reset your {APP_NAME} password";
    users.resetPasswordTemplate.body = [
      "<p>Hello,</p>",
      "<p>Click on the button below to reset your password.</p>",
      '<p><a class="btn" href="{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}" target="_blank" rel="noopener">Reset password</a></p>',
      "<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>",
      "<p>Thanks,<br/>{APP_NAME} team</p>",
    ].join("\n");
    app.save(users);
  },
);

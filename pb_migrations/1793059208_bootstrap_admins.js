/// <reference path="../pb_data/types.d.ts" />

// Creates the two admin accounts from env variables on the first start of a new deployment,
// so nobody has to open the PocketBase installer:
//   POCKETBASE_SUPERUSER_EMAIL / POCKETBASE_SUPERUSER_PASSWORD → PocketBase superuser
//     (the same variables the Next.js server uses to reach the database)
//   STORE_ADMIN_EMAIL / STORE_ADMIN_PASSWORD → store owner's dashboard account (admin)
// Accounts that already exist are left as they are. Missing variables are skipped with a log line.
// Like every migration it runs once; later changes go through the dashboard or `npm run create-admin`.
migrate(
  (app) => {
    const env = (name) => ($os.getenv(name) || "").trim();
    const findByEmail = (collection, email) => {
      try {
        return app.findAuthRecordByEmail(collection, email);
      } catch (err) {
        // Not found.
        return null;
      }
    };

    // ---------- PocketBase superuser ----------
    const su_email = env("POCKETBASE_SUPERUSER_EMAIL").toLowerCase();
    const su_password = env("POCKETBASE_SUPERUSER_PASSWORD");
    if (!su_email || su_password.length < 10) {
      console.log(
        "[admins] POCKETBASE_SUPERUSER_EMAIL / POCKETBASE_SUPERUSER_PASSWORD (10+ chars) not set: superuser skipped.",
      );
    } else if (!findByEmail("_superusers", su_email)) {
      const superuser = new Record(app.findCollectionByNameOrId("_superusers"));
      superuser.setEmail(su_email);
      superuser.setPassword(su_password);
      app.save(superuser);
      console.log(`[admins] Created PocketBase superuser ${su_email}.`);
    }

    // ---------- Store admin (dashboard) ----------
    const admin_email = env("STORE_ADMIN_EMAIL").toLowerCase();
    const admin_password = env("STORE_ADMIN_PASSWORD");
    if (!admin_email || admin_password.length < 8) {
      console.log("[admins] STORE_ADMIN_EMAIL / STORE_ADMIN_PASSWORD (8+ chars) not set: store admin skipped.");
      return;
    }

    let user = findByEmail("users", admin_email);
    if (!user) {
      user = new Record(app.findCollectionByNameOrId("users"));
      user.setEmail(admin_email);
      user.setPassword(admin_password);
      user.setVerified(true);
      user.set("name", "Store admin");
      app.save(user);
      console.log(`[admins] Created store admin ${admin_email}.`);
    }

    let member = null;
    try {
      member = app.findFirstRecordByFilter("team_members", "user = {:user}", { user: user.id });
    } catch (err) {
      // No team membership yet.
    }
    if (!member) member = new Record(app.findCollectionByNameOrId("team_members"));
    member.set("user", user.id);
    member.set("roles", ["admin"]);
    member.set("is_admin", true);
    member.set("is_active", true);
    app.save(member);
  },
  () => {
    // Accounts are data, not schema: rolling back the migration keeps them.
  },
);

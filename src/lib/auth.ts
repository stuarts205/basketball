import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  user: {
    additionalFields: {
      // input: false keeps clients from setting this during sign-up.
      isSuperAdmin: { type: "boolean", defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // The first account ever created is the super admin who sets up the bracket.
        before: async (user) => {
          const existing = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .limit(1);
          return { data: { ...user, isSuperAdmin: existing.length === 0 } };
        },
      },
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "tooling-checks",
		include: ["**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/.git/**"],
		passWithNoTests: true,
	},
});

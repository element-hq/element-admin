import * as v from "valibot";

/**
 * The runtime-defineable configuration
 *
 * This is stored in the 'APP_CONFIG_BASE64' global as a base64'd JSON object
 */
const AppConfigSchema = v.object({
  serverName: v.nullable(v.string()),
});

type AppConfig = v.InferOutput<typeof AppConfigSchema>;

interface IWindow {
  APP_CONFIG_BASE64?: string;
}

let appConfig: AppConfig = {
  serverName: null,
};

const configSource = (globalThis as IWindow).APP_CONFIG_BASE64;
if (configSource !== "APP_CONFIG_PLACEHOLDER" && configSource) {
  try {
    appConfig = v.parse(AppConfigSchema, JSON.parse(atob(configSource)));
  } catch (error) {
    console.warn(
      "Failed to parse configuration, falling back to the default configuration",
      error,
    );
  }
} else {
  console.log("Using default configuration");
}

export default appConfig;

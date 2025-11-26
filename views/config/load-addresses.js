// Helper to load the latest deployed contract addresses for the current network
// This file is written once and reused by all views (user, data-consumer, etc.)

window.loadContractAddresses = async function () {
  try {
    // Network hint can be set from each HTML view, falls back to 'localhost'
    const network = window.CONTRACT_CONFIG_NETWORK || "localhost";
    const response = await fetch(`../config/addresses-${network}.json`, {
      cache: "no-cache",
    });

    if (!response.ok) {
      console.warn(
        "[FitDAO] Failed to load addresses JSON for network:",
        network,
        response.status,
        response.statusText
      );
      return null;
    }

    const json = await response.json();
    return json;
  } catch (err) {
    console.error("[FitDAO] Error loading contract addresses:", err);
    return null;
  }
};



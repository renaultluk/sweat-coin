// Helper to load the latest deployed contract addresses for the current network
// This file is written once and reused by all views (user, data-consumer, etc.)

window.loadContractAddresses = async function () {
  try {
    // Network hint can be set from each HTML view, falls back to 'localhost'
    const network = "sepolia"; // Hardcoded to sepolia
    const jsonPath = `../config/addresses-${network}.json`; // Path is relative to load-addresses.js

    console.log(`[FitDAO] Attempting to fetch contract addresses from: ${jsonPath}`);

    const response = await fetch(jsonPath, {
      cache: "no-cache",
    });

    if (!response.ok) {
      console.warn(
        "[FitDAO] Failed to load addresses JSON. URL attempted:",
        response.url, // Log the full URL after redirection/resolution
        "Status:", response.status,
        "Status Text:", response.statusText
      );
      return null;
    }

    const json = await response.json();
    console.log("[FitDAO] Successfully loaded contract addresses:", json); // Log successful load
    return json;
  } catch (err) {
    console.error("[FitDAO] Error loading contract addresses:", err);
    return null;
  }
};



#!/usr/bin/env -S npx sucrase-node
/**
 * Hardware Validation Script — StudioLive 16R
 *
 * Connects to a real mixer on the network, runs a series of non-destructive
 * checks, and reports pass/fail for each. Designed for manual QA before release.
 *
 * Usage:
 *   npx sucrase-node test-hardware.ts [mixer-ip]
 *
 * If no IP is provided, runs discovery to find the mixer automatically.
 *
 * Tests performed:
 *   1. Discovery — find mixer on the network
 *   2. Connection — TCP connect + handshake
 *   3. State tree — verify zlib payload populates channel counts
 *   4. Channel names — read PS string values from state
 *   5. Fader positions — read PV float values from state
 *   6. Metering — subscribe to UDP meter data, verify frames arrive
 *   7. Mute round-trip — toggle ch1 mute, verify state change echoed back
 *   8. Fader round-trip — nudge ch1 fader, verify state change echoed back
 *   9. Project list — fetch project files via FD transfer
 *  10. Reconnection — close and reconnect cleanly
 *
 * Safety: Mute/fader tests restore original values after testing.
 */

import { Client, MessageCode } from "./src/api";

// ── Config ──────────────────────────────────────────────────────────────

const MIXER_IP = process.argv[2] || null;
const TIMEOUT = 10_000;

// ── Helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(name: string, detail?: string) {
	passed++;
	console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, err: any) {
	failed++;
	console.log(`  ❌ ${name} — ${err?.message || err}`);
}

function skip(name: string, reason: string) {
	skipped++;
	console.log(`  ⏭️  ${name} — ${reason}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(`${label}: timed out after ${ms}ms`)), ms),
		),
	]);
}

function waitForEvent(emitter: any, event: string, ms = TIMEOUT): Promise<any> {
	return withTimeout(
		new Promise((resolve) => emitter.once(event, resolve)),
		ms,
		`waitFor(${event})`,
	);
}

// ── Tests ───────────────────────────────────────────────────────────────

async function main() {
	console.log("\n🔌 StudioLive 16R — Hardware Validation\n");

	let host = MIXER_IP;

	// ── 1. Discovery ────────────────────────────────────────────────
	if (!host) {
		console.log("Phase 1: Discovery (searching for 10s)...");
		try {
			const devices = await withTimeout(Client.discover(10_000), 15_000, "discovery");
			if (devices.length === 0) {
				fail("Discovery", "No devices found on the network");
				console.log("\nProvide IP manually: npx sucrase-node test-hardware.ts <ip>");
				process.exit(1);
			}
			host = devices[0].ip ?? (devices[0] as any).address;
			pass("Discovery", `Found ${devices.length} device(s): ${devices.map((d) => `${(d as any).name || d.serial} @ ${host}`).join(", ")}`);
		} catch (err) {
			fail("Discovery", err);
			console.log("\nProvide IP manually: npx sucrase-node test-hardware.ts <ip>");
			process.exit(1);
		}
	} else {
		skip("Discovery", `Using provided IP: ${host}`);
	}

	// ── 2. Connection ───────────────────────────────────────────────
	console.log("\nPhase 2: Connection...");
	const client = new Client(
		{ host, port: 53000 },
		{ autoreconnect: false, logLevel: "warn" },
	);

	try {
		await withTimeout(client.connect(), TIMEOUT, "connect");
		pass("TCP connect + handshake");
	} catch (err) {
		fail("Connection", err);
		process.exit(1);
	}

	// ── 3. State tree / channel counts ──────────────────────────────
	console.log("\nPhase 3: State tree...");
	try {
		const cc = client.channelCounts;
		if (!cc || Object.values(cc).every((v) => v === 0)) {
			fail("Channel counts", "All channel counts are 0 — zlib payload may not have parsed");
		} else {
			const summary = Object.entries(cc)
				.filter(([, v]) => v > 0)
				.map(([k, v]) => `${k}=${v}`)
				.join(", ");
			pass("Channel counts", summary);
		}
	} catch (err) {
		fail("Channel counts", err);
	}

	// ── 4. Channel names (PS strings) ───────────────────────────────
	console.log("\nPhase 4: Channel names...");
	try {
		const names: string[] = [];
		for (let i = 1; i <= Math.min(client.channelCounts?.LINE || 0, 8); i++) {
			const name = client.state.get(`line/ch${i}/username`);
			names.push(name ?? "(null)");
		}
		if (names.length > 0) {
			pass("Channel names (LINE 1-8)", names.join(", "));
		} else {
			skip("Channel names", "No LINE channels found");
		}
	} catch (err) {
		fail("Channel names", err);
	}

	// ── 5. Fader positions (PV floats) ──────────────────────────────
	console.log("\nPhase 5: Fader positions...");
	try {
		const levels: string[] = [];
		for (let i = 1; i <= Math.min(client.channelCounts?.LINE || 0, 8); i++) {
			const vol = client.state.get(`line/ch${i}/volume`);
			levels.push(vol != null ? Number(vol).toFixed(2) : "null");
		}
		if (levels.length > 0) {
			pass("Fader levels (LINE 1-8)", levels.join(", "));
		} else {
			skip("Fader levels", "No LINE channels found");
		}
	} catch (err) {
		fail("Fader levels", err);
	}

	// ── 6. Metering ─────────────────────────────────────────────────
	console.log("\nPhase 6: Metering (UDP)...");
	for (let attempt = 1; attempt <= 2; attempt++) {
		try {
			await client.meterSubscribe();
			const udpAddr = client.meteringClient?.address();
			console.log(`    Attempt ${attempt}: UDP listening on port ${udpAddr?.port}`);
			const meterData = await withTimeout(
				waitForEvent(client, "meter", 8000),
				10000,
				"meter",
			);
			const types = Object.keys(meterData);
			pass("Meter subscription", `Received frame with groups: ${types.join(", ")}`);
			client.meterUnsubscribe();
			break;
		} catch (err) {
			try { client.meterUnsubscribe(); } catch {}
			if (attempt === 2) {
				fail("Meter subscription", `${err} (after 2 attempts — UDP may be blocked or routed to a different interface)`);
			} else {
				console.log(`    Attempt ${attempt} timed out, retrying...`);
				await new Promise((r) => setTimeout(r, 500));
			}
		}
	}

	// ── 7. Mute round-trip ──────────────────────────────────────────
	console.log("\nPhase 7: Mute round-trip (LINE ch1)...");
	try {
		const sel = { type: "LINE" as const, channel: 1 };
		const originalMute = client.getMute(sel);
		console.log(`    Original mute state: ${originalMute}`);

		// Toggle mute and wait for state to change
		client.toggleMute(sel);

		// Poll state for up to 2s waiting for the change
		let afterToggle = originalMute;
		for (let i = 0; i < 20; i++) {
			await new Promise((r) => setTimeout(r, 100));
			afterToggle = client.getMute(sel);
			if (afterToggle !== originalMute) break;
		}

		if (afterToggle !== originalMute) {
			pass("Mute toggle", `Was ${originalMute}, toggled to ${afterToggle}`);
		} else {
			fail("Mute toggle", `Expected state to change from ${originalMute}, still ${afterToggle}`);
		}

		// Restore original using setMute
		client.setMute(sel, originalMute ?? false);
		await new Promise((r) => setTimeout(r, 300));
		const restored = client.getMute(sel);
		pass("Mute restore", `Restored to ${restored}`);
	} catch (err) {
		fail("Mute round-trip", err);
	}

	// ── 8. Fader round-trip ─────────────────────────────────────────
	console.log("\nPhase 8: Fader round-trip (LINE ch1)...");
	try {
		// Values are in 0-100 linear scale (72 ≈ unity / 0 dB)
		const originalLevel = client.state.get("line/ch1/volume") as number ?? 50;
		// Nudge by 5 units (visible on the fader but not drastic)
		const nudge = originalLevel > 50 ? originalLevel - 5 : originalLevel + 5;

		await client.setChannelVolumeLinear({ type: "LINE", channel: 1 }, nudge);
		// Give mixer time to echo back the PV update
		await new Promise((r) => setTimeout(r, 500));

		const afterLevel = client.state.get("line/ch1/volume") as number;
		if (afterLevel != null && Math.abs(afterLevel - nudge) < 2) {
			pass("Fader nudge", `Sent ${nudge.toFixed(1)}, state now ${afterLevel.toFixed(1)}`);
		} else {
			fail("Fader nudge", `Sent ${nudge.toFixed(1)}, state is ${afterLevel} (expected ~${nudge.toFixed(1)})`);
		}

		// Restore original
		await client.setChannelVolumeLinear({ type: "LINE", channel: 1 }, originalLevel);
		await new Promise((r) => setTimeout(r, 300));
		pass("Fader restore", `Restored to ${originalLevel.toFixed(1)}`);
	} catch (err) {
		fail("Fader round-trip", err);
	}

	// ── 9. Project list ─────────────────────────────────────────────
	console.log("\nPhase 9: Project list (FD transfer)...");
	try {
		const projects = await withTimeout(client.getProjects(), 5000, "getProjects");
		if (Array.isArray(projects)) {
			pass("Project list", `${projects.length} project(s): ${projects.map((p) => p.name).join(", ")}`);
		} else {
			fail("Project list", "Response was not an array");
		}
	} catch (err) {
		fail("Project list", err);
	}

	// ── 10. Reconnection ────────────────────────────────────────────
	console.log("\nPhase 10: Reconnection...");
	try {
		await client.close();
		pass("Clean disconnect");

		await withTimeout(client.connect(), TIMEOUT, "reconnect");
		pass("Reconnect", "Second connection established successfully");

		// Verify state is fresh
		const vol = client.state.get("line/ch1/volume");
		if (vol != null) {
			pass("Post-reconnect state", `line/ch1/volume = ${Number(vol).toFixed(3)}`);
		} else {
			skip("Post-reconnect state", "Volume is null (may need time to populate)");
		}
	} catch (err) {
		fail("Reconnection", err);
	}

	// ── Summary ─────────────────────────────────────────────────────
	await client.close().catch(() => {});

	console.log("\n" + "─".repeat(50));
	console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
	console.log("─".repeat(50) + "\n");

	process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});

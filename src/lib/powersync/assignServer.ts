import { supabaseConnector } from "@/lib/powersync/SupabaseConnector.ts";

/**
 * Simple utility to measure ping using an HTTP HEAD request.
 * If the request fails, we treat the ping as Infinity.
 */
async function measurePing(url: string): Promise<number> {
    console.log(`Measuring ping for ${url}`);
    // If the server URL contains 'journeryapps', assign ping=100 without querying
    if (url.includes('journeyapps')) {
        return 300;
    }

    const startTime = performance.now();
    try {
        // You might want to append a `/health` or a specific endpoint if needed
        await fetch(url.concat('/probes/liveness'), { method: 'HEAD' });
        return performance.now() - startTime;
    } catch {
        if (url.includes('journeyapps')) {
            return 300;
        }
        return Infinity;
    }
}

async function assignClosestHealthyServer(userId: string): Promise<string> {
    // 1. Fetch all healthy servers
    const healthyServers = await supabaseConnector.client.functions.invoke('get_ps_servers');
    console.log(healthyServers);

    // 2. Measure ping for each healthy server
    const serverPings = await Promise.all(
        healthyServers.data.map(async (server: { server_url: string }) => {
            const ping = await measurePing(server.server_url);
            return { server, ping };
        })
    );

    // 3. Determine the server with the lowest ping
    let bestServer = serverPings[0].server;
    let minPing = serverPings[0].ping;
    for (const { server, ping } of serverPings) {
        if (ping < minPing) {
            minPing = ping;
            bestServer = server;
        }
    }

    console.log(
        `Assigned user ${userId} to server ${bestServer.server_url} (ping: ${minPing.toFixed(2)} ms)`
    );
    return bestServer.server_url;
}

export { assignClosestHealthyServer };

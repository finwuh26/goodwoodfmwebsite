export const getAzuracastStreamers = async (url: string, apiKey: string) => {
    if (!url || !apiKey) throw new Error("Azuracast API URL and Key are required.");
    const res = await fetch(`${url}/api/station/1/streamers`, {
        headers: {
            'X-API-Key': apiKey,
        }
    });
    if (!res.ok) throw new Error("Failed to fetch streamers from AzuraCast");
    return res.json();
};

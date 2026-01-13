
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function fingerprintDevice(mac: string, vendor: string, hostname: string, ttl: number) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform OS fingerprinting: MAC: ${mac}, Vendor: ${vendor}, Hostname: ${hostname}, TTL: ${ttl}. Return JSON with likelyOS and deviceType.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            likelyOS: { type: Type.STRING },
            deviceType: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: ["likelyOS", "deviceType"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return { likelyOS: "Unknown Linux/Unix", deviceType: "unknown", confidence: 0 };
  }
}

export async function simulateDeepProbe(hostname: string, ip: string, command: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Simulate terminal output for the command "${command}" targeted at ${hostname} (${ip}). Make it look like real Linux terminal output.`,
    });
    return response.text;
  } catch (e) {
    return `Error connecting to ${ip}: Connection timed out.`;
  }
}

export async function generateNetworkAudit(devices: any[]) {
  try {
    const deviceSummary = devices.map(d => `- ${d.hostname} (${d.ip}): ${d.vendor}, Ports: [${d.openPorts.join(',')}]`).join('\n');
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Perform a detailed security audit for this local network:\n${deviceSummary}\nIdentify risks, rogue device patterns, and suggest hardened firewall rules. Use professional Markdown.`,
    });
    return response.text;
  } catch (e) {
    return "Audit Engine Offline. Please verify API configuration.";
  }
}

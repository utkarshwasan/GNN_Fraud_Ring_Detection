const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

class ApiService {
  async getAlerts() {
    const response = await fetch(`${API_BASE_URL}/api/alerts`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Failed to fetch alerts");
    }
    return await response.json();
  }

  async analyzeTransaction(transactionData) {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transactionData),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Failed to analyze transaction");
    }
    return await response.json();
  }

  /**
   * Step 1: Start the investigation job.
   * Returns a job_id.
   */
  async startInvestigation(transactionId) {
    const response = await fetch(`${API_BASE_URL}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: transactionId }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Failed to start investigation");
    }
    return await response.json(); // e.g., { job_id: "...", message: "..." }
  }

  /**
   * Step 2: Poll for the investigation status.
   * Returns the status object.
   */
  async getInvestigationStatus(jobId) {
    const response = await fetch(
      `${API_BASE_URL}/api/investigate/status/${jobId}`
    );
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Failed to get investigation status");
    }
    return await response.json(); // e.g., { job_id: "...", status: "running" | "completed" | "failed", ... }
  }
}

export default new ApiService();

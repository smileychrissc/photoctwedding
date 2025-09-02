import { useState } from "react";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardMedia,
  Checkbox,
  CircularProgress,
} from "@mui/material";

const API_BASE = window._env_?.REACT_APP_API_BASE || "http://localhost:80";

// Helper for API calls with error handling
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Error ${res.status}`);
  }
  return res;
}

export default function DownloadPage() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    try {
      const res = await apiFetch("/images", {
        headers: { "x-password": password },
      });
      const data = await res.json();

      const abs = data.map((x) => ({
        ...x,
        absUrl: x.url.startsWith("http") ? x.url : `${API_BASE}${x.url}`,
      }));

      setImages(abs);
      setAuthorized(true);
    } catch (err) {
      alert("Invalid password or server unreachable.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(filename) {
    setSelected((prev) =>
      prev.includes(filename)
        ? prev.filter((f) => f !== filename)
        : [...prev, filename]
    );
  }

  async function downloadSelected() {
    if (!selected.length) return;
    try {
      const res = await apiFetch("/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-password": password,
        },
        body: JSON.stringify(selected),
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "photos_bundle.zip");
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Download failed. Check the password or try again.");
    }
  }

  if (!authorized) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: "center" }}>
        <Typography variant="h5" mb={2}>
          🔐 Enter Password
        </Typography>
        <TextField
          fullWidth
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          label="Password"
          variant="outlined"
        />
        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 2 }}
          onClick={login}
          disabled={!password || loading}
        >
          {loading ? <CircularProgress size={24} /> : "Unlock"}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h5">📥 Download Photos</Typography>
        <Button
          variant="contained"
          disabled={!selected.length}
          onClick={downloadSelected}
        >
          Download Selected ({selected.length})
        </Button>
      </Box>

      <Grid container spacing={2}>
        {images.map((img) => (
          <Grid item xs={6} sm={4} md={3} key={img.filename}>
            <Card sx={{ position: "relative", borderRadius: 3 }}>
              <CardMedia
                component="img"
                image={img.absUrl}
                alt={img.filename}
                sx={{ aspectRatio: "1 / 1" }}
              />
              <Checkbox
                checked={selected.includes(img.filename)}
                onChange={() => toggleSelect(img.filename)}
                sx={{
                  position: "absolute",
                  top: 5,
                  left: 5,
                  color: "white",
                  background: "rgba(0,0,0,0.4)",
                  borderRadius: "50%",
                }}
              />
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

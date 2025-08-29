
import { useState, useEffect } from "react";
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
} from "@mui/material";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "http://18.222.102.87";

export default function DownloadPage() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState([]);

  async function login() {
    try {
      const { data } = await axios.get(`${API_BASE}/images`);
      const abs = data.map((x) => ({
        ...x,
        absUrl: x.url.startsWith("http") ? x.url : `${API_BASE}${x.url}`,
      }));
      setImages(abs);
      setAuthorized(true);
    } catch (err) {
      alert("Server unreachable");
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
      const res = await axios.post(`${API_BASE}/download`, selected, {
        responseType: "blob",
        headers: {
          "Content-Type": "application/json",
          "x-password": password,
        },
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "photos_bundle.zip");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert("Download failed. Check the password.");
    }
  }

  if (!authorized) {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Typography variant="h5" mb={2}>🔐 Enter Password</Typography>
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
        >
          Unlock
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


import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import {
  Box,
  Container,
  Typography,
  Button,
  Fragment,
  Grid,
  Card,
  CardMedia,
  LinearProgress,
  Dialog,
  IconButton,
  useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useSwipeable } from "react-swipeable";

const API_BASE = "http://18.222.102.87" || process.env.REACT_APP_API_BASE;

export default function App() {
  const theme = useTheme();
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const fileRef = useRef(null);

  // Detect if screen width is "small" (e.g., phone)
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));

  async function loadImages() {
    console.log('HACK: LOAD APIBASE',API_BASE);
    const { data } = await axios.get(`${API_BASE}/images`);
    const abs = data.map((x) => ({
      ...x,
      absUrl: x.url.startsWith("http") ? x.url : `${API_BASE}${x.url}`,
    }));
    setImages(abs);
  }

  useEffect(() => {
    loadImages();
  }, []);

  function handleSelect(e) {
    setFiles(Array.from(e.target.files || []));
  }

  async function upload() {
    if (!files.length) return;
    setBusy(true);
    setProgress(0);
    const form = new FormData();
    files.forEach((f) => form.append("files", f, f.name));

    try {
      console.log('HACK: UPLOAD APIBASE',API_BASE);
      await axios.post(`${API_BASE}/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setProgress(pct);
        },
      }).then(res => {
        if (res?.data?.uploaded) {
          const dupes = res.data.uploaded.filter(u => u.duplicate).map(u => u.original);
          if (dupes.length) console.log("Duplicates skipped:", dupes.join(", "));
        }
      });
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      await loadImages();
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  function handleOpen(index) {
    setActiveIndex(index);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setActiveIndex(null);
  }

  const showPrev = useCallback(() => {
    if (images.length === 0) return;
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const showNext = useCallback(() => {
    if (images.length === 0) return;
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => showNext(),
    onSwipedRight: () => showPrev(),
    trackMouse: true,
  });

  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "ArrowLeft") showPrev();
      else if (e.key === "ArrowRight") showNext();
      else if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, showPrev, showNext]);

  return (
    <Container id="wrapper" maxWidth="md" sx={{ py: 4, minWidth:'100vw', minHeight:'100vh'}} style={{padding:'0px' }}>
      <Box
        id="title-wrapper"
        display="flex"
        flexDirection={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        mb={3}
        gap={isPhone ? 1 : 2}
        sx={{backgroundColor:'#C2DED1', padding:isPhone ? '24px 15px 10px 15px': '24px 15px 0px 15px', borderBotton:'1px solid black', margin:'0px'}}
      >
        <Typography variant={isPhone ? "h4" : "h2"} fontWeight="200">
          Trevor & Calysta Photos
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleSelect}
            style={{ display: "none" }}
            id="file-input"
          />
          <label htmlFor="file-input">
            <Button variant="outlined" component="span">
              Choose Images
            </Button>
          </label>
          <Button
            variant="contained"
            disabled={busy || !files.length}
            onClick={upload}
          >
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </Box>
      </Box>
      <Grid container direction="column" alignItems="start" justifyContent="start" 
            sx={{backgroundColor:'#C2DED1', padding:isPhone ? '0px 24px 5px 24px': '0px 24px 0px 24px', borderBottom:'1px solid grey', boxShadow:'5px 5px 5px lightgrey', marginBottom:'10px'}}
      >
        <Typography variant="body1" sx={{color:'dimgrey', fontSize:'smaller'}}>
          1&#183; Choose the images to upload
        </Typography>
        <Typography variant="body1" sx={{color:'dimgrey', fontSize:'smaller'}}>
          2&#183; Click the upload button to upload them
        </Typography>
      </Grid>

      {files.length > 0 && (
        <Box id="wedding-selected" mb={3} sx={{padding:'0px 24px 0px 24px',borderBottom:'1px solid grey', boxShadow:'5px 5px 5px lightgrey'}}>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {files.length} selected
          </Typography>
          <Box display="flex" gap={1} overflow="auto">
            {files.map((f, i) => (
              <Box
                key={i}
                component="img"
                src={URL.createObjectURL(f)}
                alt={f.name}
                sx={{
                  height: 80,
                  width: 80,
                  objectFit: "cover",
                  borderRadius: 2,
                  border: "1px solid #ddd",
                }}
              />
            ))}
          </Box>
          {busy && (
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ mt: 2, borderRadius: 5 }}
            />
          )}
        </Box>
      )}

      <Grid id="images-wrapepr" container spacing={2} sx={{padding:'0px 24px 0px 24px'}}>
        {images.map((img, idx) => (
          <Grid item xs={6} sm={4} md={3} key={img.filename}>
            <Card
              sx={{ borderRadius: 3, overflow: "hidden", cursor: "pointer" }}
              onClick={() => handleOpen(idx)}
            >
              <CardMedia
                component="img"
                image={img.absUrl}
                alt={img.filename}
                sx={{ aspectRatio: "1 / 1" }}
              />
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog
        fullScreen
        open={open}
        onClose={handleClose}
        PaperProps={{ sx: { backgroundColor: "black" } }}
      >
        <IconButton
          onClick={handleClose}
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            color: "white",
            zIndex: 10,
          }}
        >
          <CloseIcon />
        </IconButton>

        {images.length > 1 && (
          <>
            <IconButton
              onClick={showPrev}
              sx={{
                position: "absolute",
                top: "50%",
                left: 10,
                color: "white",
                zIndex: 10,
                backgroundColor: "rgba(0,0,0,0.3)",
              }}
            >
              <ArrowBackIosNewIcon />
            </IconButton>
            <IconButton
              onClick={showNext}
              sx={{
                position: "absolute",
                top: "50%",
                right: 10,
                color: "white",
                zIndex: 10,
                backgroundColor: "rgba(0,0,0,0.3)",
              }}
            >
              <ArrowForwardIosIcon />
            </IconButton>
          </>
        )}

        {activeIndex !== null && images[activeIndex] && (
          <Box {...swipeHandlers} sx={{ width: "100vw", height: "100vh" }}>
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={5}
              doubleClick={{ mode: "zoomIn" }}
              pinch={{ disabled: false }}
              panning={{ disabled: false }}
              wheel={{ step: 0.2 }}
            >
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={images[activeIndex].absUrl}
                  alt={images[activeIndex].filename}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                  }}
                />
              </TransformComponent>
            </TransformWrapper>
          </Box>
        )}
      </Dialog>
    </Container>
  );
}

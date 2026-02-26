import Image from "next/image";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

type ImagePreviewDialogProps = {
  open: boolean;
  selectedImageUrl: string | null;
  file: File | null;
  onClose: () => void;
};

export function ImagePreviewDialog({ open, selectedImageUrl, file, onClose }: ImagePreviewDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ pr: 10 }}>
        <Typography component="span" variant="subtitle2" noWrap>
          {file?.name}
        </Typography>
      </DialogTitle>
      <DialogActions sx={{ px: 3, pt: 0 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <DialogContent>
        {selectedImageUrl && file ? (
          <Image
            src={selectedImageUrl}
            alt={`Full-size selected receipt image: ${file.name}`}
            width={1600}
            height={2200}
            unoptimized
            className="max-h-[78vh] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

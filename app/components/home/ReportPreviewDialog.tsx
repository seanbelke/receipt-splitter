import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

type ReportPreviewDialogProps = {
  reportHtmlPreview: string | null;
  onPrint: () => void;
  onClose: () => void;
};

export function ReportPreviewDialog({ reportHtmlPreview, onPrint, onClose }: ReportPreviewDialogProps) {
  return (
    <Dialog open={!!reportHtmlPreview} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>HTML report preview</DialogTitle>
      <DialogContent dividers>
        <iframe
          title="Receipt split report preview"
          srcDoc={reportHtmlPreview ?? undefined}
          className="h-[72vh] w-full rounded-xl border border-slate-200 bg-white"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onPrint}>Print</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

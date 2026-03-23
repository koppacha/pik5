import {Alert, AlertTitle, Snackbar} from "@mui/material"
import {RECORD_TOAST_DURATION_MS} from "../../lib/recordNotification"

export default function RecordNotificationToast({open, payload, onClose}) {
    return (
        <Snackbar
            open={open}
            autoHideDuration={RECORD_TOAST_DURATION_MS}
            onClose={onClose}
            anchorOrigin={{vertical: "bottom", horizontal: "right"}}
        >
            <Alert
                onClose={onClose}
                icon={false}
                variant="standard"
                sx={{
                    whiteSpace: "pre-line",
                    maxWidth: 420,
                    alignItems: "flex-start",
                    backgroundColor: "var(--color-bg-base)",
                    color: "var(--color-text-base)",
                    border: "1px solid var(--color-border-base)",
                    boxShadow: "none",
                    "& .MuiAlert-action": {
                        color: "var(--color-text-base)",
                        paddingTop: "2px",
                    },
                }}
            >
                <AlertTitle>{payload?.title || "新着記録"}</AlertTitle>
                {payload?.body || ""}
            </Alert>
        </Snackbar>
    )
}

import {useState} from 'react'
import {Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle} from '@mui/material'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faImage, faTrashCan} from '@fortawesome/free-solid-svg-icons'
import {score2str} from '../../lib/factory'
import {worldRecordPlatformNames} from '../../lib/worldRecordScore'
import useWorldRecordPermissions from '../../hooks/useWorldRecordPermissions'

export function ReferenceScoreBorder({children}) {
    return <Box style={{color: '#e81fc1', borderBottom: '2px dotted #e81fc1', textAlign: 'center', margin: '8px 0'}}>{children}</Box>
}

export default function WorldRecordBorder({record, stage, rule, onDeleted}) {
    const [open, setOpen] = useState(false)
    const [confirm, setConfirm] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const permissions = useWorldRecordPermissions()
    async function remove() {
        if (busy || !permissions.canDelete) return
        setBusy(true)
        setError('')
        try {
            const response = await fetch(`/api/world-records?id=${record.id}`, {method: 'DELETE'})
            if (!response.ok) throw new Error('削除できませんでした')
            setConfirm(false)
            await Promise.all([onDeleted?.(), permissions.refresh()])
        } catch (failure) { setError(failure.message) }
        finally { setBusy(false) }
    }
    return <ReferenceScoreBorder>
        世界記録（{worldRecordPlatformNames[record.platform]}） {record.holder_name} {score2str(record.score, rule, stage, record.score_type)}
        {(record.img_url || permissions.canDelete) && <span style={{display: 'inline-flex', verticalAlign: 'middle', marginRight: 20}}>
        {record.img_url && <>
            <button type="button" aria-label="世界記録の証拠画像" onClick={() => setOpen(true)} style={{color: 'inherit', border: 0, background: 'transparent', cursor: 'pointer'}}><FontAwesomeIcon icon={faImage} /></button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg"><Box component="img" src={`/api/file/${record.img_url}`} alt="世界記録の証拠画像" style={{maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain'}} /></Dialog>
        </>}
        {permissions.canDelete && <>
            <button type="button" aria-label={`世界記録を削除（${worldRecordPlatformNames[record.platform]}）`} onClick={() => { setError(''); setConfirm(true) }} style={{color: 'inherit', border: 0, background: 'transparent', cursor: 'pointer'}}><FontAwesomeIcon icon={faTrashCan} /></button>
            <Dialog open={confirm} onClose={() => !busy && setConfirm(false)} PaperProps={{style: {backgroundColor: '#fff', color: '#222'}}}>
                <DialogTitle>この世界記録を削除しますか？</DialogTitle>
                {error && <DialogContent><Alert severity="error">{error}</Alert></DialogContent>}
                <DialogActions><Button disabled={busy} onClick={() => setConfirm(false)}>キャンセル</Button><Button disabled={busy} onClick={remove} color="error">削除する</Button></DialogActions>
            </Dialog>
        </>}
        </span>}
    </ReferenceScoreBorder>
}

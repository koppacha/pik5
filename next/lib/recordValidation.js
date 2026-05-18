import * as yup from "yup"
import {newUserEvidenceRequirements} from "./const"

const newUserDays = 30
const newUserPostCount = 30

export const evidenceMessages = {
    video: "新規登録者がこの順位の記録を投稿するには、証拠動画が必要です。",
    image: "新規登録者がこの順位の記録を投稿するには、証拠画像または証拠動画が必要です。",
}

function hasValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== ""
}

export function hasEvidenceVideo(videoUrl) {
    return hasValue(videoUrl)
}

export function hasEvidenceImage(image) {
    if (!image) return false
    if (typeof image === "string") return hasValue(image)
    if (typeof File !== "undefined" && image instanceof File) return true
    if (typeof Blob !== "undefined" && image instanceof Blob) return true
    if (Array.isArray(image)) return image.length > 0
    if (typeof FileList !== "undefined" && image instanceof FileList) return image.length > 0
    return Boolean(image?.name || image?.filepath || image?.originalFilename || image?.newFilename)
}

export function normalizeCountInfo(countInfo) {
    const source = Array.isArray(countInfo) ? countInfo[0] : countInfo
    return {
        count: Number(source?.cnt || 0),
        oldestCreatedAt: source?.oldest_created_at || null,
    }
}

export function isNewUserByPostHistory(countInfo, now = new Date()) {
    const {count, oldestCreatedAt} = normalizeCountInfo(countInfo)
    if (count < newUserPostCount) return true
    if (!oldestCreatedAt) return true

    const oldestDate = new Date(oldestCreatedAt)
    if (Number.isNaN(oldestDate.getTime())) return true

    const days = (now.getTime() - oldestDate.getTime()) / 86400000
    return days < newUserDays
}

export function getNewUserEvidenceRequirement(rule, stageId) {
    const ruleRequirement = newUserEvidenceRequirements[Number(rule)]
    if (!ruleRequirement) return null

    const override = ruleRequirement.stageOverrides?.[Number(stageId)]
    return override || {
        video: ruleRequirement.video,
        image: ruleRequirement.image,
    }
}

function rankRequiresEvidence(requirementValue, rank) {
    if (!requirementValue) return false
    if (requirementValue === "q") return true

    const requirementRank = Number(requirementValue)
    const currentRank = Number(rank)
    if (!Number.isFinite(requirementRank) || requirementRank <= 0) return false
    if (!Number.isFinite(currentRank) || currentRank <= 0) return false
    return currentRank <= requirementRank
}

export function getNewUserEvidenceState({rule, stageId, rank, countInfo, videoUrl, image}) {
    const requirement = getNewUserEvidenceRequirement(rule, stageId)
    const isNewUser = isNewUserByPostHistory(countInfo)
    const hasVideo = hasEvidenceVideo(videoUrl)
    const hasImage = hasEvidenceImage(image)

    if (!requirement || !isNewUser) {
        return {
            isNewUser,
            requiresVideo: false,
            requiresImage: false,
            missingVideo: false,
            missingImage: false,
        }
    }

    const requiresVideo = rankRequiresEvidence(requirement.video, rank)
    const requiresImage = !hasVideo && rankRequiresEvidence(requirement.image, rank)

    return {
        isNewUser,
        requiresVideo,
        requiresImage,
        missingVideo: requiresVideo && !hasVideo,
        missingImage: requiresImage && !hasImage,
    }
}

export function createRecordValidationSchema({
    isTime = false,
    time2score = null,
    rule = null,
    stageId = null,
    rank = null,
    countInfo = null,
    image = null,
} = {}) {
    return yup.object({
        score: yup
            .number()
            .min(1, "０点以下は登録できません。")
            .max(99999, "スコアの最大値は99,999です"),
        videoUrl: yup
            .string()
            .matches(
                /^$|^https?:\/\/(www\.)?(nicovideo\.jp|youtube\.com|youtu\.be|twitch\.tv|twitter\.com)\/[\w\-/?=]*$/,
                {message: "有効なURLではありません。有効な動画サイトは「YouTube」「ニコニコ動画」「Twitch」「Twitter」です。"}
            )
            .max(128, "URLの最大文字数は128文字です。")
            .test("newUserEvidenceVideo", evidenceMessages.video, function (value) {
                const state = getNewUserEvidenceState({
                    rule: this.parent.rule || rule,
                    stageId,
                    rank,
                    countInfo,
                    videoUrl: value,
                    image: this.parent.img || image,
                })
                return !state.missingVideo
            }),
        comment: yup
            .string()
            .max(128, "コメントの最大文字数は128文字です。"),
        rule: yup
            .number()
            .min(1, "ルールの選択は必須です。"),
        console: yup
            .number()
            .min(1, "操作方法の選択は必須です。"),
        time: yup
            .string()
            .matches(/^$|^(?:(?:\d{1,2}:)?\d{2}:)?\d{2}$/, "正しくない時間フォーマットが入力されています。00:00:00形式で入力してください。")
            .test("isTimeValid", "1以下のスコアは登録できません。", function (value) {
                if (!isTime) return true
                if (typeof time2score !== "function") return true
                const calculatedScore = time2score(value)
                return calculatedScore > 1
            }),
        img: yup
            .mixed()
            .test("newUserEvidenceImage", evidenceMessages.image, function (value) {
                const state = getNewUserEvidenceState({
                    rule: this.parent.rule || rule,
                    stageId,
                    rank,
                    countInfo,
                    videoUrl: this.parent.videoUrl,
                    image: value || image,
                })
                return !state.missingImage
            }),
    })
}

import nodemailer from 'nodemailer'

export function getTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    })
}

export async function sendMail({ to, subject, text }) {
    const transporter = getTransporter()
    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        text,
    })
}
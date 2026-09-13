export const passwordPattern = /^[\x21\x23-\x26\x28-\x3B\x3D\x3F-\x5B\x5D-\x7E]+$/

export function isValidPassword(password){
    return typeof password === "string"
        && password.length >= 8
        && password.length <= 72
        && passwordPattern.test(password)
}

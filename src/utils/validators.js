export const STUDENT_NO = /^\d{10}$/ // e.g. 2020100450
export const PH_MOBILE = /^09\d{9}$/ // e.g. 09123456789

export const cleanStudentNo = (value) => value.replace(/\D/g, '').slice(0, 10)

export const cleanPhone = (value) => {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('639')) digits = `0${digits.slice(2)}` // +63 9xx -> 09xx
  return digits.slice(0, 11)
}
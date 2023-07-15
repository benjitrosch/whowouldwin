import { init } from "./fire"

const DEFAULT_SUBMIT_TEXT = "Ask ChatGPT"
const LOADING_SUBMIT_TEXT = "Fighting..."
const FAILURE_SUBMIT_TEXT = "Try again"

const LABEL_ARIA_TEXT = (fight: string) => `Who would win in a ${fight}?`

const DEFAULT_PLACEHOLDERS: [string, string][] = [
    ["Goku", "Superman"],
    ["Bear", "Gorilla"],
    ["Ninjas", "Pirates"],
    ["Robocop", "Terminator"],
    ["Godzilla", "King Kong"],
    ["Myself", "100 five year-olds"],
    ["Mark Zuckerberg", "Elon Musk"],
]

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message)
}

const form = document.forms[0] as HTMLFormElement

assert(!!form, 'Could not find form element')

const inputA = form.querySelector('input[name=first') as HTMLInputElement
const inputB = form.querySelector('input[name=second') as HTMLInputElement
const selectFight = form.querySelector('select[name=select-competition]') as HTMLSelectElement
const buttonSubmit = form.querySelector('button') as HTMLButtonElement

assert(!!inputA || !!inputB, 'Could not find input elements')
assert(!!selectFight, 'Could not find select element')
assert(!!buttonSubmit, 'Could not find submit button')

const randomIndex = Math.floor(Math.random() * DEFAULT_PLACEHOLDERS.length)
inputA.placeholder = DEFAULT_PLACEHOLDERS[randomIndex][0]
inputB.placeholder = DEFAULT_PLACEHOLDERS[randomIndex][1]

const answerContainer = document.getElementById('answer') as HTMLDivElement

assert(!!answerContainer, 'Could not find answer container')

function validateInput(e: KeyboardEvent) {
    const INPUT_VALIDATION_REGEX = /^[a-zA-Z0-9-' ]+$/
    const char = e.key

    if (!INPUT_VALIDATION_REGEX.test(char)) {
        e.preventDefault()
        return false
    }
}

function validateButtonState() {
    const bothInputsAreValid = inputA.value.length > 1 && inputB.value.length > 1
    buttonSubmit.disabled = !bothInputsAreValid
}

async function askPrompt(e: SubmitEvent) {
    e.preventDefault()

    disableAllInputs()
    buttonSubmit.innerText = LOADING_SUBMIT_TEXT
    answerContainer.innerText = ""

    const fight = selectFight.value
    const a = inputA.value
    const b = inputB.value

    const stream = new EventSource(`/api/ai?fight=${fight}&a=${a}&b=${b}`)

    stream.addEventListener('message', function(e) {
        if (e.data === '[DONE]') {
            stream.close()

            enableAllInputs()
            buttonSubmit.innerText = DEFAULT_SUBMIT_TEXT

            return
        }

        const message = JSON.parse(e.data)
        const delta = message.choices[0].delta.content

        if (delta) {
            answerContainer.innerText += delta

            if (answerContainer.innerText.length > 0) {
                answerContainer.tabIndex = 0
                answerContainer.parentElement?.classList.remove('hidden')
            }
        }
    })

    stream.addEventListener('error', function(e) {
        function error() {
            enableAllInputs()
            buttonSubmit.innerText = FAILURE_SUBMIT_TEXT
        }

        const event = e.target as EventSource
        if (event.readyState === EventSource.CLOSED) {
            console.log('EventSource connection closed')
            error()
        } else if (event.readyState === EventSource.CONNECTING) {
            console.log('EventSource connection failed. Retrying...')
        } else {
            console.error('EventSource encountered an unknown error:', e)
            error()
        }
    })
}

function getTextWidth(text: string, font: string, fontSize: number) {
    const canvas = document.createElement('canvas') as HTMLCanvasElement
    const context = canvas.getContext('2d') as CanvasRenderingContext2D

    assert(!!canvas, "Failed to create canvas")
    assert(!!context, "Failed to create rendering context2d")

    context.font = `${fontSize}px ${font}`
    const metrics = context.measureText(text)

    return metrics.width
}

function debounce(func: () => void, wait: number): () => void {
    let timeout: ReturnType<typeof setTimeout> | null
    return function () {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(func, wait)
    }
}

function resizeSelect() {
    const text = selectFight.options[selectFight.selectedIndex].text
    const style = window.getComputedStyle(selectFight)
    const font =  style.getPropertyValue('font-family')
    const fontSize = parseInt(style.getPropertyValue('font-size'), 10)
    const textWidth = getTextWidth(text, font, fontSize)

    selectFight.style.width = `${textWidth + 20}px`
}

function updateSelectAriaLabel() {
    const options = selectFight.querySelectorAll('option')
    const selectedIndex = selectFight.selectedIndex
    const value = options[selectedIndex].value

    const label = selectFight.parentElement as HTMLLabelElement
    label.setAttribute('aria-label', LABEL_ARIA_TEXT(value))   
}

function handleSelect() {
    resizeSelect()
    updateSelectAriaLabel()
}

function disableAllInputs() {
    inputA.disabled = true
    inputB.disabled = true
    selectFight.disabled = true
    buttonSubmit.disabled = true
}

function enableAllInputs() {
    inputA.disabled = false
    inputB.disabled = false
    selectFight.disabled = false
    buttonSubmit.disabled = false
}

resizeSelect()
updateSelectAriaLabel()

selectFight.addEventListener('change', handleSelect)
window.addEventListener('resize', debounce(resizeSelect, 100))

inputA.addEventListener('keypress', validateInput)
inputB.addEventListener('keypress', validateInput)

inputA.addEventListener('input', validateButtonState)
inputB.addEventListener('input', validateButtonState)

form.addEventListener('submit', askPrompt)

init()

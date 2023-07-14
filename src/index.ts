const DEFAULT_SUBMIT_TEXT = "Ask ChatGPT"
const LOADING_SUBMIT_TEXT = "Fighting..."
const FAILURE_SUBMIT_TEXT = "Try again"

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message)
}

const form = document.forms[0] as HTMLFormElement

assert(!!form, 'Could not find form element')

const firstInput = form.querySelector('input[name=first') as HTMLInputElement
const secondInput = form.querySelector('input[name=second') as HTMLInputElement
const fightSelect = form.querySelector('select[name=select-competition]') as HTMLSelectElement
const submitButton = form.querySelector('button') as HTMLButtonElement

assert(!!firstInput || !!secondInput, 'Could not find input elements')
assert(!!fightSelect, 'Could not find select element')
assert(!!submitButton, 'Could not find submit button')

const helpModal = document.querySelector('dialog') as HTMLDialogElement
const helpButton = document.querySelector('button') as HTMLButtonElement
const exitModalButton = helpModal.querySelector('button') as HTMLButtonElement

assert(!!helpModal, 'Could not find help modal')
assert(!!helpButton, 'Could not find help button')
assert(!!exitModalButton, 'Could not find exit modal button')

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
    const bothInputsAreValid = firstInput.value.length > 1 && secondInput.value.length > 1
    submitButton.disabled = !bothInputsAreValid
}

async function askPrompt(e: SubmitEvent) {
    e.preventDefault()

    disableAllInputs()
    submitButton.innerText = LOADING_SUBMIT_TEXT
    answerContainer.innerText = ""

    const fight = fightSelect.value.slice(0, fightSelect.value.length - 1)
    const a = firstInput.value
    const b = secondInput.value

    const stream = new EventSource(`/api/ai?fight=${fight}&a=${a}&b=${b}`)

    stream.addEventListener('message', function(e) {
        if (e.data === '[DONE]') {
            stream.close()

            enableAllInputs()
            submitButton.innerText = DEFAULT_SUBMIT_TEXT

            return
        }

        const message = JSON.parse(e.data)
        const delta = message.choices[0].delta.content

        if (delta) {
            answerContainer.innerText += delta
            answerContainer.parentElement?.classList.remove('hidden')
        }
    })

    stream.addEventListener('error', function(e) {
        function error() {
            enableAllInputs()
            submitButton.innerText = FAILURE_SUBMIT_TEXT
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

function resizeSelect() {
    const text = fightSelect.options[fightSelect.selectedIndex].text
    const style = window.getComputedStyle(document.body)
    const font =  style.getPropertyValue('font-family')
    const fontSize = 2 * parseInt(style.getPropertyValue('font-size'), 10)
    const textWidth = getTextWidth(text, font, fontSize)

    fightSelect.style.width = `${textWidth + 20}px`
}

function disableAllInputs() {
    firstInput.disabled = true
    secondInput.disabled = true
    fightSelect.disabled = true
    submitButton.disabled = true
}

function enableAllInputs() {
    firstInput.disabled = false
    secondInput.disabled = false
    fightSelect.disabled = false
    submitButton.disabled = false
}

function openHelpModal() { helpModal.showModal() }
function closeHelpModal() { helpModal.close() }

resizeSelect()
fightSelect.addEventListener('change', resizeSelect)

helpButton.addEventListener('click', openHelpModal)
exitModalButton.addEventListener('click', closeHelpModal)

firstInput.addEventListener('keypress', validateInput)
secondInput.addEventListener('keypress', validateInput)

firstInput.addEventListener('input', validateButtonState)
secondInput.addEventListener('input', validateButtonState)

form.addEventListener('submit', askPrompt)

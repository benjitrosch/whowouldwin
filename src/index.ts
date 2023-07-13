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

async function validateSubmit(e: SubmitEvent) {
    e.preventDefault()

    disableAllInputs()
    submitButton.innerText = "Fighting..."

    try {
        postAnswer(firstInput.value + ", " + secondInput.value)
        answerContainer.parentElement?.classList.remove('hidden')
    } catch (e) {
        submitButton.innerText = "Try again"
        console.error(e)
    } finally {
        submitButton.innerText = "Ask ChatGPT"
        enableAllInputs()
    }
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

function postAnswer(answer: string) {
    answerContainer.innerText = answer
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

form.addEventListener('submit', validateSubmit)

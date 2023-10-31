
// This is for local testing
// const rootURL = 'http://127.0.0.1:8090/'
// This is for when its live on job sheets
const rootURL = 'http://192.168.5.7:8090/'

function openPopUp(x,y) {
	document.getElementById('popUpTitle').innerText = x
	document.getElementById('popUpContent').innerText = y
	document.getElementById('popUpMessage').style.display = 'Block';
}

function closePopUp() {
	document.getElementById('popUpMessage').style.display = 'None';
}

function assignSignIn() {
	document.getElementById('logInForm').addEventListener('submit', function (e) {
		e.preventDefault()
		let email = document.getElementById('emailInput').value;
		let password = document.getElementById('passwordInput').value
		const y = { email, password}
		const x = JSON.stringify(y)
		fetch(rootURL + 'login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: x
		}).then(
			async response => {
				if (response.status === 200) {
					fetch(
						URL
					).then(
						window.location.assign('main.html')
					)
				} else if (response.status === 500) {
					openPopUp('Sign In Error', 'Internal server error')
				} else {
					openPopUp('Sign In Error', 'Sign in failed - please try again.')
				}
			}
		)
		
	})
}

function loadFunctions() {
	assignSignIn();
}

document.addEventListener('DOMContentLoaded', loadFunctions)
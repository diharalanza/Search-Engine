document.getElementById("searchBtn").addEventListener("click", searchBtnClicked);

function searchBtnClicked() {

    document.getElementById("searchResults").innerHTML = ""

    if(validation()){
        document.getElementById('searchResults').innerHTML = 'loading results...';

        let searchValue = {}
        searchValue.text = document.getElementById("searchBox").value;
        console.log(searchValue)
    
        let query = createSearchQuery();
    
        req = new XMLHttpRequest();
        req.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                console.log('Submitted!');
    
                window.location.href = query;
            }
        }
    
        req.open("GET", query);
    
        req.setRequestHeader('Accept', 'text/html');
        req.send()
    }
    else{
        alert("limit must be atleast 1 and at most 50.")
    }
}

function createSearchQuery() {
    let queryString = "";
    let q = document.getElementById("searchBox").value;
    let boost = document.getElementById("boost").checked;
    let limit = document.getElementById("limit").value;
    return "/fruits?q=" + q + "&boost=" + boost + "&limit=" + limit
}

function validation() {
    if (document.getElementById("limit").value > 50 || document.getElementById("limit").value < 1) {
        return false;
    }
    else{
        return true;
    }
}

import axios from 'axios';


const api = axios.create({

    baseURL: '/api',

    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },

    withCredentials: true,

    withXSRFToken: true,
});


/*
|--------------------------------------------------------------------------
| Token support
|--------------------------------------------------------------------------
|
| Если твой backend возвращает token,
| автоматически сохраняем его.
|
|--------------------------------------------------------------------------
*/

api.interceptors.response.use(

    (response) => {

        const token =
            response.data?.token ??
            response.data?.access_token;


        if (token) {

            localStorage.setItem(
                'auth_token',
                token
            );

            api.defaults.headers.common[
                'Authorization'
            ] = `Bearer ${token}`;
        }


        return response;
    },

    (error) => {

        return Promise.reject(error);
    }
);


/*
|--------------------------------------------------------------------------
| Restore token
|--------------------------------------------------------------------------
*/

const existingToken =
    localStorage.getItem(
        'auth_token'
    );


if (existingToken) {

    api.defaults.headers.common[
        'Authorization'
    ] = `Bearer ${existingToken}`;
}


export default api;
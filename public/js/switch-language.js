$(document).ready(function () {
    function languageSelect(defaultLang) {
        $("[i18n]").i18n({
            defaultLang: defaultLang,
            filePath: "public/i18n/",
            filePrefix: "i18n_",
            fileSuffix: "",
            forever: true,
            callback: function (res) {
                // console.log(res)
            }
        });
    };
    if(!sessionStorage.getItem('__bdht_lan')){
        languageSelect('cn')
        sessionStorage.setItem('__bdht_lan',"cn")
    } else {
        var defaultLang = sessionStorage.getItem("__bdht_lan");
        languageSelect(defaultLang);
    }

    $('#switch-language-i18n-cn').on('click',function (e) {
        languageSelect('cn')
        sessionStorage.setItem('__bdht_lan',"cn")
    });
    $('#switch-language-i18n-en').on('click',function (e) {
        languageSelect('en')
        sessionStorage.setItem('__bdht_lan',"en")
    });

    $('#switch-language-i18n-cn1').on('click',function (e) {
        languageSelect('cn')
        sessionStorage.setItem('__bdht_lan',"cn")
    });
    $('#switch-language-i18n-en1').on('click',function (e) {
        languageSelect('en')
        sessionStorage.setItem('__bdht_lan',"en")
    });
});
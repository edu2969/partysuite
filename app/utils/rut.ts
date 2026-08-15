export default function CheckRut(rutSinGuion: string) {
  if (rutSinGuion.toString().trim() != '') {
    var caracteres = new Array();
    var serie = new Array(2, 3, 4, 5, 6, 7);
    var dig = rutSinGuion.toString().substr(rutSinGuion.toString().length - 1, 1);
    rutSinGuion = rutSinGuion.toString().substr(0, rutSinGuion.toString().length - 1);

    for (var i = 0; i < rutSinGuion.length; i++) {
      caracteres[i] = parseInt(rutSinGuion.charAt((rutSinGuion.length - (i + 1))));
    }

    var sumatoria = 0;
    var k = 0;
    var resto = 0;

    for (var j = 0; j < caracteres.length; j++) {
      if (k == 6) {
        k = 0;
      }
      sumatoria += parseInt(caracteres[j]) * serie[k];
      k++;
    }

    resto = sumatoria % 11;
    let dv : number | string = 11 - resto;

    if (dv == 10) {
      dv = -1;
    } else if (dv == 11) {
      dv = 0;
    }

    if (dv.toString().trim().toUpperCase() === dig.toString().trim().toUpperCase())
      return true;
    else
      return false;
  } else {
    return false;
  }
}
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class BrickScript : MonoBehaviour
{
    public int point;

    public Color[] colors;

    public Transform explosion;

    public Transform livesPowerUp;

    GameManager gm;

    int hitsToBreak;

    SpriteRenderer brickRenderer;

    // Start is called before the first frame update
    void Start()
    {
        gm = GameObject.Find("GameManager").GetComponent<GameManager>();
        if (point > colors.Length)
        {
            point = colors.Length;
        }
        hitsToBreak = point;
        brickRenderer = gameObject.GetComponent<SpriteRenderer>();
        SetBrickColor(hitsToBreak - 1);
    }

    // Update is called once per frame
    void Update()
    {

    }

    public void BallHitUpdate()
    {
        hitsToBreak--;
        if (hitsToBreak > 0)
        {
            SetBrickColor(hitsToBreak - 1);
        }
        else
        {
            Explode();
            GivePowerUpRandomly();
            Destroy(gameObject);
        }
    }

    void Explode()
    {
        Transform newExplosion = Instantiate(explosion, transform.position, transform.rotation);
        Destroy(newExplosion.gameObject, 2.5f);
        gm.UpdateScore(point);
        gm.UpdateNumberOfBricks();
    }

    void GivePowerUpRandomly()
    {
        float random = Random.Range(1, 101);
        if (random < 20)
        {
            Instantiate(livesPowerUp, transform.position, transform.rotation);
        }
    }

    void SetBrickColor(int index)
    {
        brickRenderer.color = colors[index];
    }
}
